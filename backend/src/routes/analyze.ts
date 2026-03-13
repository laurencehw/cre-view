import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { MOCK_BUILDINGS } from '../data/mockData';
import { createVisionService } from '../services/vision';
import logger from '../services/logger';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin, supabaseEnabled } from '../services/supabase';

export const analyzeRouter = Router();

// ─── Multer (file upload) config ─────────────────────────────────────────────
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB ?? '') || 10) * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  logger.error(err, `Failed to create uploads directory at "${UPLOAD_DIR}"`);
  throw new Error('Server initialization failed: unable to create uploads directory');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});

// ─── POST /api/analyze-skyline ────────────────────────────────────────────────
analyzeRouter.post(
  '/analyze-skyline',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Image exceeds size limit', code: 'FILE_TOO_LARGE' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: 'Only JPEG, PNG or WebP images are accepted', code: 'INVALID_FILE_TYPE' });
        return;
      }
      if (err) return next(err);
      next();
    });
  },
  [
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image attached', code: 'FILE_REQUIRED' });
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid parameters', details: errors.array() });
        return;
      }

      // Run the image through the configured vision service
      const visionService = createVisionService();
      const imageBuffer = await fs.promises.readFile(req.file.path);
      const visionResult = await visionService.analyze(imageBuffer, req.file.mimetype);

      // Optionally persist the image to Supabase Storage
      if (supabaseEnabled && supabaseAdmin) {
        const storagePath = `skylines/${uuidv4()}${path.extname(req.file.originalname).toLowerCase()}`;
        supabaseAdmin.storage
          .from('skyline-uploads')
          .upload(storagePath, imageBuffer, { contentType: req.file.mimetype })
          .then(({ error }) => {
            if (error) logger.warn({ error }, 'Failed to upload to Supabase Storage');
            else logger.info({ storagePath }, 'Image uploaded to Supabase Storage');
          });
      }

      // Clean up local file after analysis
      fs.promises.unlink(req.file.path).catch((err) => logger.warn(err, `Failed to delete uploaded file ${req.file?.path}`));

      // Cross-reference detected landmarks against known buildings
      const detectedBuildings = visionResult.landmarks
        .map((landmark, idx) => {
          const match = MOCK_BUILDINGS.find(
            (b) => b.name.toLowerCase() === landmark.name.toLowerCase(),
          );
          return match
            ? {
                buildingId: match.id,
                name: match.name,
                confidence: landmark.confidence,
                boundingBox: landmark.boundingBox ?? {
                  x: 80 + idx * 120,
                  y: 40,
                  width: 70,
                  height: 250,
                },
              }
            : null;
        })
        .filter(Boolean);

      // Fallback: if no landmark matches, return top buildings as mock results
      const results =
        detectedBuildings.length > 0
          ? detectedBuildings
          : MOCK_BUILDINGS.slice(0, 3).map((b, i) => ({
              buildingId: b.id,
              name: b.name,
              confidence: parseFloat((0.95 - i * 0.04).toFixed(2)),
              boundingBox: { x: 80 + i * 120, y: 40, width: 60 + i * 10, height: 280 - i * 30 },
            }));

      res.json({
        analysisId: `ana_${uuidv4().split('-')[0]}`,
        detectedBuildings: results,
        processedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);
