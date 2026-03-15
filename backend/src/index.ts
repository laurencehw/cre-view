import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pinoHttp from 'pino-http';
import logger from './services/logger';
import { analyzeRouter } from './routes/analyze';
import { buildingsRouter } from './routes/buildings';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { nycDataRouter } from './routes/nycData';
import { rateLimit } from './middleware/rateLimit';

// Load .env from project root (monorepo), falling back to cwd
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config(); // also check cwd for local overrides

const app = express();
const PORT = process.env.PORT ?? 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS: use CORS_ORIGIN env var if set, otherwise default to localhost:3000 in dev
const corsOrigin = process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000');
app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : { origin: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Enable trust proxy so req.ip reflects the real client IP behind a reverse proxy
app.set('trust proxy', 1);

// Rate limiting — 100 requests per minute per IP (configurable via env)
app.use('/api', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '') || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '') || 100,
}));

// Serve uploaded files (dev only — use object storage in production)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', analyzeRouter);
app.use('/api', buildingsRouter);
app.use('/api', nycDataRouter);

// ─── Serve frontend static files (production) ───────────────────────────────
// The Next.js static export lives at frontend/out (built at deploy time).
// Serving it from Express eliminates CORS entirely — same origin for API + UI.
const frontendDir = path.join(__dirname, '..', '..', 'frontend', 'out');
app.use(express.static(frontendDir, { extensions: ['html'] }));
// SPA fallback: for client-side routes like /buildings/bld_123,
// try to serve the parent page (buildings.html), then fall back to index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  // Try parent path (e.g., /buildings/bld_xxx → buildings.html)
  const parentDir = path.dirname(req.path);
  if (parentDir !== '/' && parentDir !== '.') {
    const parentHtml = path.join(frontendDir, parentDir + '.html');
    if (fs.existsSync(parentHtml)) {
      return res.sendFile(parentHtml);
    }
    const parentIndex = path.join(frontendDir, parentDir, 'index.html');
    if (fs.existsSync(parentIndex)) {
      return res.sendFile(parentIndex);
    }
  }

  res.sendFile(path.join(frontendDir, 'index.html'), (err) => {
    if (err) next();
  });
});

// ─── 404 Handler (API only) ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`CRE View API running on http://localhost:${PORT}`);
  });
}

export default app;
