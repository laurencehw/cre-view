import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { analyzeRouter } from './routes/analyze';
import { buildingsRouter } from './routes/buildings';
import { healthRouter } from './routes/health';
import { rateLimit } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api', analyzeRouter);
app.use('/api', buildingsRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CRE View API running on http://localhost:${PORT}`);
  });
}

export default app;
