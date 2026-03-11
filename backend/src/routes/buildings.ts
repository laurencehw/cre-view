import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import { MOCK_BUILDINGS, findBuildingById, findFinancialsByBuildingId } from '../data/mockData';

export const buildingsRouter = Router();

// ─── GET /api/buildings ───────────────────────────────────────────────────────
buildingsRouter.get(
  '/buildings',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid query params', details: errors.array() });
        return;
      }

      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const search = (req.query.search as string | undefined)?.toLowerCase();

      let filtered = MOCK_BUILDINGS;
      if (search) {
        filtered = filtered.filter(
          (b) =>
            b.name.toLowerCase().includes(search) ||
            b.address.toLowerCase().includes(search),
        );
      }

      const total = filtered.length;
      const start = (page - 1) * limit;
      const data = filtered.slice(start, start + limit);

      res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/buildings/:id ───────────────────────────────────────────────────
buildingsRouter.get(
  '/buildings/:id',
  [param('id').isString().notEmpty()],
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building id', code: 'INVALID_ID' });
        return;
      }

      const building = findBuildingById(req.params.id);
      if (!building) {
        res.status(404).json({ error: 'Building not found', code: 'NOT_FOUND' });
        return;
      }

      res.json(building);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/buildings/:id/financials ───────────────────────────────────────
buildingsRouter.get(
  '/buildings/:id/financials',
  [param('id').isString().notEmpty()],
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building id', code: 'INVALID_ID' });
        return;
      }

      const building = findBuildingById(req.params.id);
      if (!building) {
        res.status(404).json({ error: 'Building not found', code: 'NOT_FOUND' });
        return;
      }

      const financials = findFinancialsByBuildingId(req.params.id);
      if (!financials) {
        res.status(404).json({ error: 'Financial data not found', code: 'NOT_FOUND' });
        return;
      }

      res.json(financials);
    } catch (err) {
      next(err);
    }
  },
);
