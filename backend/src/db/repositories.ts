// Repository layer that abstracts data access from route handlers.
// Uses real SQL queries via getDb() — the mock client in connection.ts
// pattern-matches SQL substrings so mock fallback continues to work.

import { getDb } from './connection';
import type { Building, BuildingFinancials, CapTableEntry } from '../data/mockData';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Snake-case DB row types ─────────────────────────────────────────────────

interface BuildingRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  height_ft: number;
  floors: number;
  completion_year: number;
  primary_use: string;
  owner: string;
  image_url?: string;
  // camelCase variants (returned by mock client)
  heightFt?: number;
  completionYear?: number;
  primaryUse?: string;
  imageUrl?: string;
}

interface FinancialsRow {
  id: string;
  building_id: string;
  as_of_date: string;
  estimated_value: number;
  currency: string;
  cap_rate: number;
  noi: number;
  total_debt: number;
  senior_loan_amount: number;
  senior_loan_lender: string;
  senior_loan_rate: number;
  senior_loan_maturity: string;
  mezz_amount: number | null;
  mezz_lender: string | null;
  mezz_rate: number | null;
  mezz_maturity: string | null;
  total_equity: number;
}

interface CapTableRow {
  investor: string;
  ownership: number;
  amount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapBuildingRow(row: BuildingRow): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heightFt: row.heightFt ?? Number(row.height_ft),
    floors: Number(row.floors),
    completionYear: row.completionYear ?? Number(row.completion_year),
    primaryUse: row.primaryUse ?? row.primary_use,
    owner: row.owner,
    imageUrl: row.imageUrl ?? row.image_url,
  };
}

function isMockResult(row: BuildingRow): boolean {
  // Mock client returns camelCase objects directly
  return row.heightFt !== undefined;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listBuildings(opts: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResult<Building>> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;
  const db = await getDb();

  if (opts.search) {
    const pattern = `%${opts.search}%`;
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM buildings WHERE name ILIKE $1 OR address ILIKE $1`,
      [pattern],
    );
    const dataResult = await db.query<BuildingRow>(
      `SELECT * FROM buildings WHERE name ILIKE $1 OR address ILIKE $1 ORDER BY name LIMIT $2 OFFSET $3`,
      [pattern, limit, offset],
    );

    // Handle mock client which returns full array
    const rows = dataResult.rows;
    if (rows.length > 0 && isMockResult(rows[0])) {
      // Mock client — filter/paginate in JS
      const search = opts.search.toLowerCase();
      const filtered = rows.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.address.toLowerCase().includes(search),
      );
      const total = filtered.length;
      const data = filtered.slice(offset, offset + limit).map(mapBuildingRow);
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const data = rows.map(mapBuildingRow);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM buildings`,
  );
  const dataResult = await db.query<BuildingRow>(
    `SELECT * FROM buildings ORDER BY name LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  const rows = dataResult.rows;
  if (rows.length > 0 && isMockResult(rows[0])) {
    const total = rows.length;
    const data = rows.slice(offset, offset + limit).map(mapBuildingRow);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
  const data = rows.map(mapBuildingRow);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getBuildingById(id: string): Promise<Building | null> {
  const db = await getDb();
  const result = await db.query<BuildingRow>(
    `SELECT * FROM buildings WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapBuildingRow(row) : null;
}

export async function getFinancialsByBuildingId(buildingId: string): Promise<BuildingFinancials | null> {
  const db = await getDb();

  const finResult = await db.query<FinancialsRow>(
    `SELECT * FROM financials WHERE building_id = $1 ORDER BY as_of_date DESC LIMIT 1`,
    [buildingId],
  );
  const fin = finResult.rows[0];
  if (!fin) return null;

  // Mock client returns the full BuildingFinancials object directly
  if ('buildingId' in fin && 'valuation' in fin) {
    return fin as unknown as BuildingFinancials;
  }

  // Real DB: fetch cap table entries
  const capResult = await db.query<CapTableRow>(
    `SELECT investor, ownership, amount FROM cap_table_entries WHERE financial_id = $1`,
    [fin.id],
  );

  const capTable: CapTableEntry[] = capResult.rows.map((r) => ({
    investor: r.investor,
    ownership: Number(r.ownership),
    amount: Number(r.amount),
  }));

  const financials: BuildingFinancials = {
    buildingId,
    asOfDate: String(fin.as_of_date),
    valuation: {
      estimatedValue: Number(fin.estimated_value),
      currency: fin.currency,
      capRate: Number(fin.cap_rate),
      noi: Number(fin.noi),
    },
    debt: {
      totalDebt: Number(fin.total_debt),
      seniorLoan: {
        amount: Number(fin.senior_loan_amount),
        lender: fin.senior_loan_lender,
        interestRate: Number(fin.senior_loan_rate),
        maturityDate: String(fin.senior_loan_maturity),
      },
      ...(fin.mezz_amount != null && {
        mezz: {
          amount: Number(fin.mezz_amount),
          lender: fin.mezz_lender!,
          interestRate: Number(fin.mezz_rate),
          maturityDate: String(fin.mezz_maturity),
        },
      }),
    },
    equity: {
      totalEquity: Number(fin.total_equity),
      capTable,
    },
  };

  return financials;
}
