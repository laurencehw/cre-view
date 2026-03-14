/**
 * Routes for querying NYC Open Data (PLUTO, ACRIS) and importing
 * buildings into the local database.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, body, validationResult } from 'express-validator';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { searchPluto, searchAcris } from '../services/nycOpenData';
import { getDb } from '../db/connection';
import logger from '../services/logger';

export const nycDataRouter = Router();

// ─── GET /api/nyc/pluto/search ──────────────────────────────────────────────
// Search NYC PLUTO data for buildings. Public endpoint.
nycDataRouter.get(
  '/nyc/pluto/search',
  optionalAuth,
  [
    query('address').optional().isString().trim(),
    query('borough').optional().isString().trim(),
    query('minFloors').optional().isInt({ min: 1 }).toInt(),
    query('buildingClass').optional().isString().trim(),
    query('minAssessedValue').optional().isInt({ min: 0 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('orderBy').optional().isIn(['assesstot', 'numfloors', 'yearbuilt', 'bldgarea']),
    query('orderDir').optional().isIn(['ASC', 'DESC']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid query params', details: errors.array() });
        return;
      }

      const results = await searchPluto({
        address: req.query.address as string | undefined,
        borough: req.query.borough as string | undefined,
        minFloors: req.query.minFloors ? Number(req.query.minFloors) : undefined,
        buildingClass: req.query.buildingClass as string | undefined,
        minAssessedValue: req.query.minAssessedValue ? Number(req.query.minAssessedValue) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        orderBy: req.query.orderBy as 'assesstot' | 'numfloors' | 'yearbuilt' | 'bldgarea' | undefined,
        orderDir: req.query.orderDir as 'ASC' | 'DESC' | undefined,
      });

      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      res.json({ data: results, total: results.length });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/nyc/import ───────────────────────────────────────────────────
// Import one or more buildings from PLUTO search results into the local DB.
// Generates realistic financials based on assessed value.
nycDataRouter.post(
  '/nyc/import',
  requireAuth,
  [
    body('buildings').isArray({ min: 1, max: 50 }),
    body('buildings.*.address').isString().notEmpty(),
    body('buildings.*.latitude').isFloat(),
    body('buildings.*.longitude').isFloat(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid request body', details: errors.array() });
        return;
      }

      const db = await getDb();
      const imported: string[] = [];
      const skipped: string[] = [];

      for (const bldg of req.body.buildings) {
        // Check if building already exists at these coordinates (within ~50m)
        const existing = await db.query<{ id: string }>(
          `SELECT id FROM buildings
           WHERE ABS(latitude - $1) < 0.0005 AND ABS(longitude - $2) < 0.0005
           LIMIT 1`,
          [bldg.latitude, bldg.longitude],
        );

        if (existing.rows.length > 0) {
          skipped.push(bldg.address);
          continue;
        }

        // Generate building ID
        const idResult = await db.query<{ id: string }>(
          `SELECT 'bld_' || substr(gen_random_uuid()::text, 1, 8) as id`,
        );
        const id = idResult.rows[0]?.id ?? `bld_${Date.now()}`;

        const primaryUse = bldg.primaryUse ?? 'Office';
        const numfloors = Math.round(bldg.numfloors ?? 1);
        const heightFt = Math.round(numfloors * 13);
        const assessedValue = bldg.assesstot ?? 0;

        // Insert building
        await db.query(
          `INSERT INTO buildings (id, name, address, latitude, longitude, height_ft, floors, completion_year, primary_use, owner)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            bldg.displayName ?? bldg.address,
            `${formatAddress(bldg.address)}, New York, NY`,
            bldg.latitude,
            bldg.longitude,
            heightFt,
            numfloors,
            bldg.yearbuilt || null,
            primaryUse,
            titleCase(bldg.ownername ?? 'Unknown'),
          ],
        );

        // Generate financials if we have assessed value
        if (assessedValue > 0) {
          const fin = generateFinancials(id, assessedValue, primaryUse);
          const finResult = await db.query<{ id: string }>(
            `INSERT INTO financials (building_id, as_of_date, estimated_value, currency, cap_rate, noi,
               total_debt, senior_loan_amount, senior_loan_lender, senior_loan_rate, senior_loan_maturity,
               mezz_amount, mezz_lender, mezz_rate, mezz_maturity, total_equity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id`,
            [
              fin.buildingId, '2025-01-01', fin.estimatedValue, 'USD', fin.capRate, fin.noi,
              fin.totalDebt, fin.seniorLoanAmount, fin.seniorLoanLender, fin.seniorLoanRate, fin.seniorLoanMaturity,
              fin.mezzAmount, fin.mezzLender, fin.mezzRate, fin.mezzMaturity, fin.totalEquity,
            ],
          );

          const financialId = finResult.rows[0]?.id;
          if (financialId) {
            for (const entry of fin.capTable) {
              await db.query(
                `INSERT INTO cap_table_entries (financial_id, investor, ownership, amount)
                 VALUES ($1, $2, $3, $4)`,
                [financialId, entry.investor, entry.ownership, entry.amount],
              );
            }
          }
        }

        imported.push(bldg.address);
        logger.info({ id, address: bldg.address }, 'Imported building from PLUTO');
      }

      res.status(201).json({
        imported: imported.length,
        skipped: skipped.length,
        importedAddresses: imported,
        skippedAddresses: skipped,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/nyc/acris/search ──────────────────────────────────────────────
// Search ACRIS for mortgage/deed transactions. Requires auth.
nycDataRouter.get(
  '/nyc/acris/search',
  requireAuth,
  [
    query('borough').isInt({ min: 1, max: 5 }).toInt(),
    query('block').isInt({ min: 1 }).toInt(),
    query('lot').isInt({ min: 1 }).toInt(),
    query('documentType').optional().isString().trim(),
    query('minAmount').optional().isInt({ min: 0 }).toInt(),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Invalid query params', details: errors.array() });
        return;
      }

      const results = await searchAcris({
        borough: Number(req.query.borough),
        block: Number(req.query.block),
        lot: Number(req.query.lot),
        documentType: req.query.documentType as string | undefined,
        minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
      res.json({ data: results, total: results.length });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Shared helpers (same logic as seed script) ─────────────────────────────

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAddress(raw: string): string {
  let addr = titleCase(raw.trim());
  addr = addr
    .replace(/\bSt\b/g, 'Street')
    .replace(/\bAv\b/g, 'Avenue')
    .replace(/\bAmer\b/g, 'Americas')
    .replace(/\bPl\b/g, 'Plaza');
  return addr;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const SENIOR_LENDERS = [
  'JPMorgan Chase', 'Wells Fargo', 'Bank of America', 'Goldman Sachs',
  'Morgan Stanley', 'Deutsche Bank', 'Citibank', 'Barclays Capital',
  'HSBC', 'BNP Paribas', 'Blackstone Mortgage Trust', 'Starwood Capital',
];

const MEZZ_LENDERS = [
  'Apollo Global Management', 'Blackstone Credit', 'Ares Management',
  'KKR Real Estate', 'Brookfield Asset Management', 'Oaktree Capital',
  'Starwood Property Trust', 'PGIM Real Estate',
];

const EQUITY_INVESTORS = [
  'Brookfield Properties', 'Blackstone Real Estate', 'Vornado Realty Trust',
  'SL Green Realty', 'Paramount Group', 'RXR Realty', 'Boston Properties',
  'Hines', 'Tishman Speyer', 'Silverstein Properties', 'Related Companies',
  'Oxford Properties', 'GIC (Singapore)', 'Abu Dhabi Investment Authority',
  'Canada Pension Plan', 'Qatar Investment Authority', 'CalPERS',
  'MetLife Investment Management', 'Allianz Real Estate',
];

function generateFinancials(buildingId: string, assessedValue: number, primaryUse: string) {
  const marketMultiplier = randomBetween(2.0, 2.8);
  const estimatedValue = Math.round(assessedValue * marketMultiplier);

  const capRateRange = primaryUse === 'Residential'
    ? [0.03, 0.045]
    : primaryUse === 'Mixed-Use'
      ? [0.04, 0.055]
      : [0.045, 0.065];
  const capRate = randomBetween(capRateRange[0], capRateRange[1]);
  const noi = Math.round(estimatedValue * capRate);

  const ltv = randomBetween(0.45, 0.65);
  const totalDebt = Math.round(estimatedValue * ltv);

  const seniorPct = randomBetween(0.65, 0.85);
  const seniorAmount = Math.round(totalDebt * seniorPct);
  const seniorRate = randomBetween(0.055, 0.075);
  const seniorMaturityYears = Math.floor(randomBetween(3, 8));
  const seniorMaturity = new Date();
  seniorMaturity.setFullYear(seniorMaturity.getFullYear() + seniorMaturityYears);

  const hasMezz = Math.random() > 0.4;
  const mezzAmount = hasMezz ? totalDebt - seniorAmount : 0;
  const mezzRate = randomBetween(0.085, 0.12);
  const mezzMaturityYears = Math.floor(randomBetween(2, 5));
  const mezzMaturity = new Date();
  mezzMaturity.setFullYear(mezzMaturity.getFullYear() + mezzMaturityYears);

  const totalEquity = estimatedValue - totalDebt;

  const numInvestors = Math.min(Math.floor(randomBetween(1, 5)), 4);
  const investors = pickN(EQUITY_INVESTORS, numInvestors);

  let remaining = 1.0;
  const capTable = investors.map((investor, i) => {
    const isLast = i === investors.length - 1;
    const ownership = isLast
      ? Math.round(remaining * 10000) / 10000
      : Math.round(randomBetween(0.15, remaining - 0.1 * (investors.length - i - 1)) * 10000) / 10000;
    remaining -= ownership;
    return {
      investor,
      ownership: Math.max(0.01, ownership),
      amount: Math.round(totalEquity * ownership),
    };
  });

  const totalOwnership = capTable.reduce((s, e) => s + e.ownership, 0);
  if (totalOwnership !== 1) {
    capTable[capTable.length - 1].ownership =
      Math.round((capTable[capTable.length - 1].ownership + (1 - totalOwnership)) * 10000) / 10000;
    capTable[capTable.length - 1].amount =
      Math.round(totalEquity * capTable[capTable.length - 1].ownership);
  }

  return {
    buildingId,
    estimatedValue,
    capRate: Math.round(capRate * 10000) / 10000,
    noi,
    totalDebt,
    seniorLoanAmount: seniorAmount,
    seniorLoanLender: pick(SENIOR_LENDERS),
    seniorLoanRate: Math.round(seniorRate * 10000) / 10000,
    seniorLoanMaturity: seniorMaturity.toISOString().split('T')[0],
    mezzAmount: hasMezz ? mezzAmount : null,
    mezzLender: hasMezz ? pick(MEZZ_LENDERS) : null,
    mezzRate: hasMezz ? Math.round(mezzRate * 10000) / 10000 : null,
    mezzMaturity: hasMezz ? mezzMaturity.toISOString().split('T')[0] : null,
    totalEquity,
    capTable,
  };
}
