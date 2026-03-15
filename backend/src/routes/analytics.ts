import { Router, Request, Response, NextFunction } from 'express';
import { optionalAuth } from '../middleware/auth';
import { getMarketSummary, getPortfolios, getDebtSchedule } from '../db/repositories';

export const analyticsRouter = Router();

// ─── GET /api/analytics/market-summary ──────────────────────────────────────
analyticsRouter.get(
  '/analytics/market-summary',
  optionalAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getMarketSummary();
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/analytics/portfolios ──────────────────────────────────────────
analyticsRouter.get(
  '/analytics/portfolios',
  optionalAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const portfolios = await getPortfolios();
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      res.json({ data: portfolios });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/analytics/debt-schedule ───────────────────────────────────────
analyticsRouter.get(
  '/analytics/debt-schedule',
  optionalAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const schedule = await getDebtSchedule();
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      res.json({ data: schedule });
    } catch (err) {
      next(err);
    }
  },
);
