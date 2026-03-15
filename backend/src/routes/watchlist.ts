import { Router, Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

export const watchlistRouter = Router();

// ─── GET /api/watchlist ─────────────────────────────────────────────────────
watchlistRouter.get(
  '/watchlist',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const db = await getDb();

      const result = await db.query<{ building_id: string; created_at: string }>(
        `SELECT building_id, created_at FROM watchlist_items WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );

      res.json({ data: result.rows.map(r => ({ buildingId: r.building_id, createdAt: r.created_at })) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/watchlist/:buildingId ────────────────────────────────────────
watchlistRouter.post(
  '/watchlist/:buildingId',
  requireAuth,
  [param('buildingId').isString().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building ID' });
        return;
      }

      const userId = req.user!.sub;
      const { buildingId } = req.params;
      const db = await getDb();

      await db.query(
        `INSERT INTO watchlist_items (user_id, building_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, buildingId],
      );

      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/watchlist/:buildingId ──────────────────────────────────────
watchlistRouter.delete(
  '/watchlist/:buildingId',
  requireAuth,
  [param('buildingId').isString().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building ID' });
        return;
      }

      const userId = req.user!.sub;
      const { buildingId } = req.params;
      const db = await getDb();

      await db.query(
        `DELETE FROM watchlist_items WHERE user_id = $1 AND building_id = $2`,
        [userId, buildingId],
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
