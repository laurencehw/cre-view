import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import { listBuildings, getBuildingById, getFinancialsByBuildingId } from '../db/repositories';

export const buildingsRouter = Router();

// ─── GET /api/buildings ───────────────────────────────────────────────────────
buildingsRouter.get(
  '/buildings',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid query params', details: errors.array() });
        return;
      }

      const result = await listBuildings({
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/buildings/:id ───────────────────────────────────────────────────
buildingsRouter.get(
  '/buildings/:id',
  [param('id').isString().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building id', code: 'INVALID_ID' });
        return;
      }

      const building = await getBuildingById(req.params.id);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building id', code: 'INVALID_ID' });
        return;
      }

      const building = await getBuildingById(req.params.id);
      if (!building) {
        res.status(404).json({ error: 'Building not found', code: 'NOT_FOUND' });
        return;
      }

      const financials = await getFinancialsByBuildingId(req.params.id);
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

// ─── GET /api/buildings/:id/financials/export ────────────────────────────────
// Returns financial data as a downloadable CSV file.
buildingsRouter.get(
  '/buildings/:id/financials/export',
  [param('id').isString().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid building id', code: 'INVALID_ID' });
        return;
      }

      const building = await getBuildingById(req.params.id);
      if (!building) {
        res.status(404).json({ error: 'Building not found', code: 'NOT_FOUND' });
        return;
      }

      const financials = await getFinancialsByBuildingId(req.params.id);
      if (!financials) {
        res.status(404).json({ error: 'Financial data not found', code: 'NOT_FOUND' });
        return;
      }

      const { valuation, debt, equity } = financials;
      const rows: string[][] = [
        ['Section', 'Field', 'Value'],
        ['Building', 'Name', building.name],
        ['Building', 'Address', building.address],
        ['Building', 'Primary Use', building.primaryUse],
        ['Building', 'Floors', String(building.floors)],
        ['Valuation', 'Estimated Value', String(valuation.estimatedValue)],
        ['Valuation', 'Cap Rate', String(valuation.capRate)],
        ['Valuation', 'NOI', String(valuation.noi)],
        ['Valuation', 'Currency', valuation.currency],
        ['Debt', 'Total Debt', String(debt.totalDebt)],
        ['Debt', 'Senior Loan Amount', String(debt.seniorLoan.amount)],
        ['Debt', 'Senior Loan Rate', String(debt.seniorLoan.interestRate)],
        ['Debt', 'Senior Loan Maturity', debt.seniorLoan.maturityDate],
        ['Debt', 'Senior Loan Lender', debt.seniorLoan.lender],
      ];

      if (debt.mezz) {
        rows.push(
          ['Debt', 'Mezzanine Amount', String(debt.mezz.amount)],
          ['Debt', 'Mezzanine Rate', String(debt.mezz.interestRate)],
          ['Debt', 'Mezzanine Maturity', debt.mezz.maturityDate],
          ['Debt', 'Mezzanine Lender', debt.mezz.lender],
        );
      }

      rows.push(['Equity', 'Total Equity', String(equity.totalEquity)]);
      for (const entry of equity.capTable) {
        rows.push([
          'Cap Table',
          entry.investor,
          `${(entry.ownership * 100).toFixed(1)}% / $${entry.amount}`,
        ]);
      }

      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      const filename = `${building.name.replace(/[^a-zA-Z0-9]/g, '_')}_financials.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);
