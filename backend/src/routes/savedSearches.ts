import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

export const savedSearchesRouter = Router();

// ─── GET /api/saved-searches ────────────────────────────────────────────────
savedSearchesRouter.get(
  '/saved-searches',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const db = await getDb();

      const result = await db.query<{ id: string; name: string; filters: string; created_at: string }>(
        `SELECT id, name, filters, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );

      res.json({
        data: result.rows.map(r => ({
          id: r.id,
          name: r.name,
          filters: typeof r.filters === 'string' ? JSON.parse(r.filters) : r.filters,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/saved-searches ───────────────────────────────────────────────
savedSearchesRouter.post(
  '/saved-searches',
  requireAuth,
  [
    body('name').isString().trim().notEmpty().isLength({ max: 100 }),
    body('filters').isObject(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid request', details: errors.array() });
        return;
      }

      const userId = req.user!.sub;
      const { name, filters } = req.body;
      const db = await getDb();

      const result = await db.query<{ id: string }>(
        `INSERT INTO saved_searches (user_id, name, filters) VALUES ($1, $2, $3) RETURNING id`,
        [userId, name, JSON.stringify(filters)],
      );

      const id = result.rows[0]?.id ?? `ss_${Date.now()}`;
      res.status(201).json({ id, name, filters });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/saved-searches/:id ─────────────────────────────────────────
savedSearchesRouter.delete(
  '/saved-searches/:id',
  requireAuth,
  [param('id').isString().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const userId = req.user!.sub;
      const db = await getDb();

      await db.query(
        `DELETE FROM saved_searches WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId],
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
