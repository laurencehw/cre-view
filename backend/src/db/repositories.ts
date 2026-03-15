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
  as_of_date: string | Date;
  estimated_value: number;
  currency: string;
  cap_rate: number;
  noi: number;
  total_debt: number;
  senior_loan_amount: number;
  senior_loan_lender: string;
  senior_loan_rate: number;
  senior_loan_maturity: string | Date;
  mezz_amount: number | null;
  mezz_lender: string | null;
  mezz_rate: number | null;
  mezz_maturity: string | Date | null;
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
  city?: string;
  primaryUse?: string;
  minFloors?: number;
  maxFloors?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}): Promise<PaginatedResult<Building>> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;
  const db = await getDb();

  // Build parameterized WHERE clause
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  if (opts.search) {
    conditions.push(`(name ILIKE $${idx} OR address ILIKE $${idx} OR owner ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }
  if (opts.city) {
    conditions.push(`address ILIKE $${idx}`);
    params.push(`%${opts.city}%`);
    idx++;
  }
  if (opts.primaryUse) {
    conditions.push(`primary_use ILIKE $${idx}`);
    params.push(opts.primaryUse);
    idx++;
  }
  if (opts.minFloors != null) {
    conditions.push(`floors >= $${idx}`);
    params.push(opts.minFloors);
    idx++;
  }
  if (opts.maxFloors != null) {
    conditions.push(`floors <= $${idx}`);
    params.push(opts.maxFloors);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Whitelist sort columns to prevent injection
  const sortColumns: Record<string, string> = {
    name: 'name', floors: 'floors', completionYear: 'completion_year',
    primaryUse: 'primary_use', address: 'address', owner: 'owner',
  };
  const orderCol = sortColumns[opts.sortBy ?? ''] ?? 'name';
  const orderDir = opts.sortDir === 'DESC' ? 'DESC' : 'ASC';

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM buildings ${where}`,
    params,
  );
  const dataResult = await db.query<BuildingRow>(
    `SELECT * FROM buildings ${where} ORDER BY ${orderCol} ${orderDir} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  const rows = dataResult.rows;

  // Mock client returns camelCase objects — filter/paginate in JS
  if (rows.length > 0 && isMockResult(rows[0])) {
    let filtered = rows as BuildingRow[];
    if (opts.search) {
      const s = opts.search.toLowerCase();
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(s) || b.address.toLowerCase().includes(s) || (b.owner ?? '').toLowerCase().includes(s),
      );
    }
    if (opts.city) {
      const c = opts.city.toLowerCase();
      filtered = filtered.filter(b => b.address.toLowerCase().includes(c));
    }
    if (opts.primaryUse) {
      const u = opts.primaryUse.toLowerCase();
      filtered = filtered.filter(b => (b.primaryUse ?? b.primary_use ?? '').toLowerCase() === u);
    }
    if (opts.minFloors != null) filtered = filtered.filter(b => Number(b.floors) >= opts.minFloors!);
    if (opts.maxFloors != null) filtered = filtered.filter(b => Number(b.floors) <= opts.maxFloors!);
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit).map(mapBuildingRow);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
  const data = rows.map(mapBuildingRow);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDistinctFilters(): Promise<{ cities: string[]; propertyTypes: string[] }> {
  const db = await getDb();

  const typeResult = await db.query<{ primary_use: string }>(
    `SELECT DISTINCT primary_use FROM buildings WHERE primary_use IS NOT NULL AND primary_use != '' ORDER BY primary_use`,
  );

  const addrResult = await db.query<{ address: string }>(
    `SELECT DISTINCT address FROM buildings WHERE address IS NOT NULL`,
  );

  // Extract city names from addresses (format: "..., City, ST")
  const citySet = new Set<string>();
  for (const { address } of addrResult.rows) {
    const parts = address.split(',').map((s: string) => s.trim());
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && candidate.length > 1 && !/^\d/.test(candidate)) {
        citySet.add(candidate);
      }
    }
  }

  return {
    cities: Array.from(citySet).sort(),
    propertyTypes: typeResult.rows.map(r => r.primary_use).filter(Boolean),
  };
}

// ─── Comps ──────────────────────────────────────────────────────────────────

export async function getComps(buildingId: string, limit = 5): Promise<Building[]> {
  const ref = await getBuildingById(buildingId);
  if (!ref) return [];

  const db = await getDb();
  const minFloors = Math.max(1, Math.floor(ref.floors * 0.8));
  const maxFloors = Math.ceil(ref.floors * 1.2);

  // Same type + similar floor count, ordered by similarity
  const result = await db.query<BuildingRow>(
    `SELECT * FROM buildings
     WHERE id != $1 AND primary_use ILIKE $2 AND floors BETWEEN $3 AND $4
     ORDER BY ABS(floors - $5), name LIMIT $6`,
    [buildingId, ref.primaryUse, minFloors, maxFloors, ref.floors, limit],
  );

  let rows = result.rows;
  if (rows.length > 0 && isMockResult(rows[0])) {
    const use = (ref.primaryUse ?? '').toLowerCase();
    rows = rows.filter(b =>
      b.id !== buildingId && (b.primaryUse ?? b.primary_use ?? '').toLowerCase() === use,
    ).slice(0, limit);
  }

  // If too few comps, broaden to same city
  if (rows.length < 2) {
    const parts = ref.address.split(',').map(s => s.trim());
    const city = parts.length >= 2 ? parts[parts.length - 2] : '';
    if (city) {
      const existingIds = new Set(rows.map(r => r.id));
      const broader = await db.query<BuildingRow>(
        `SELECT * FROM buildings WHERE id != $1 AND address ILIKE $2
         ORDER BY ABS(floors - $3), name LIMIT $4`,
        [buildingId, `%${city}%`, ref.floors, limit + existingIds.size],
      );
      let extra = broader.rows;
      if (extra.length > 0 && isMockResult(extra[0])) {
        const c = city.toLowerCase();
        extra = extra.filter(b => b.id !== buildingId && !existingIds.has(b.id) && b.address.toLowerCase().includes(c));
      } else {
        extra = extra.filter(b => !existingIds.has(b.id));
      }
      rows = [...rows, ...extra].slice(0, limit);
    }
  }

  return rows.map(mapBuildingRow);
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface MarketSummary {
  byCity: { city: string; count: number; avgCapRate: number; avgFloors: number }[];
  byType: { type: string; count: number; avgCapRate: number; avgValue: number }[];
  totals: { buildingCount: number; avgCapRate: number; totalValue: number };
}

export async function getMarketSummary(): Promise<MarketSummary> {
  const db = await getDb();

  // Type aggregates
  const typeResult = await db.query<{
    primary_use: string; count: string; avg_cap_rate: string; avg_value: string;
  }>(`
    SELECT b.primary_use, COUNT(DISTINCT b.id)::text as count,
           AVG(f.cap_rate)::text as avg_cap_rate,
           AVG(f.estimated_value)::text as avg_value
    FROM buildings b
    LEFT JOIN financials f ON f.building_id = b.id
    WHERE b.primary_use IS NOT NULL AND b.primary_use != ''
    GROUP BY b.primary_use ORDER BY COUNT(DISTINCT b.id) DESC
  `);

  // Totals
  const totalsResult = await db.query<{ count: string; avg_cap_rate: string; total_value: string }>(`
    SELECT COUNT(DISTINCT b.id)::text as count,
           AVG(f.cap_rate)::text as avg_cap_rate,
           COALESCE(SUM(f.estimated_value), 0)::text as total_value
    FROM buildings b
    LEFT JOIN financials f ON f.building_id = b.id
  `);

  // City aggregation via address parsing in JS
  const addrResult = await db.query<{ address: string; floors: string; cap_rate: string | null }>(`
    SELECT b.address, b.floors::text, f.cap_rate::text
    FROM buildings b
    LEFT JOIN financials f ON f.building_id = b.id
  `);

  const cityAgg = new Map<string, { count: number; capRates: number[]; floors: number[] }>();
  for (const row of addrResult.rows) {
    const parts = (row.address ?? '').split(',').map((s: string) => s.trim());
    const city = parts.length >= 2 ? parts[parts.length - 2] : '';
    if (!city || city.length <= 1 || /^\d/.test(city)) continue;
    const entry = cityAgg.get(city) ?? { count: 0, capRates: [], floors: [] };
    entry.count++;
    const cr = parseFloat(row.cap_rate ?? '');
    if (cr > 0) entry.capRates.push(cr);
    entry.floors.push(parseInt(row.floors) || 0);
    cityAgg.set(city, entry);
  }

  const byCity = Array.from(cityAgg.entries())
    .map(([city, d]) => ({
      city,
      count: d.count,
      avgCapRate: d.capRates.length ? d.capRates.reduce((a, b) => a + b, 0) / d.capRates.length : 0,
      avgFloors: d.floors.length ? Math.round(d.floors.reduce((a, b) => a + b, 0) / d.floors.length) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byType = typeResult.rows.map(r => ({
    type: r.primary_use,
    count: parseInt(r.count),
    avgCapRate: parseFloat(r.avg_cap_rate) || 0,
    avgValue: parseFloat(r.avg_value) || 0,
  }));

  const t = totalsResult.rows[0];
  return {
    byCity,
    byType,
    totals: {
      buildingCount: parseInt(t?.count ?? '0'),
      avgCapRate: parseFloat(t?.avg_cap_rate ?? '0') || 0,
      totalValue: parseFloat(t?.total_value ?? '0'),
    },
  };
}

export interface Portfolio {
  owner: string;
  buildingCount: number;
  totalValue: number;
  avgCapRate: number;
  buildings: { id: string; name: string; address: string }[];
}

export async function getPortfolios(): Promise<Portfolio[]> {
  const db = await getDb();

  const ownerResult = await db.query<{
    owner: string; count: string; total_value: string; avg_cap_rate: string;
  }>(`
    SELECT b.owner, COUNT(DISTINCT b.id)::text as count,
           COALESCE(SUM(f.estimated_value), 0)::text as total_value,
           AVG(f.cap_rate)::text as avg_cap_rate
    FROM buildings b
    LEFT JOIN financials f ON f.building_id = b.id
    WHERE b.owner IS NOT NULL AND b.owner != '' AND LOWER(b.owner) != 'unknown'
    GROUP BY b.owner
    HAVING COUNT(DISTINCT b.id) >= 2
    ORDER BY SUM(f.estimated_value) DESC NULLS LAST
    LIMIT 20
  `);

  if (ownerResult.rows.length === 0) return [];

  // Fetch buildings for all portfolio owners in one query
  const ownerNames = ownerResult.rows.map(r => r.owner);
  const placeholders = ownerNames.map((_, i) => `$${i + 1}`).join(',');
  const bldgResult = await db.query<{ id: string; name: string; address: string; owner: string }>(
    `SELECT id, name, address, owner FROM buildings WHERE owner IN (${placeholders}) ORDER BY owner, name`,
    ownerNames,
  );

  const bldgsByOwner = new Map<string, { id: string; name: string; address: string }[]>();
  for (const b of bldgResult.rows) {
    const list = bldgsByOwner.get(b.owner) ?? [];
    list.push({ id: b.id, name: b.name, address: b.address });
    bldgsByOwner.set(b.owner, list);
  }

  return ownerResult.rows.map(r => ({
    owner: r.owner,
    buildingCount: parseInt(r.count),
    totalValue: parseFloat(r.total_value),
    avgCapRate: parseFloat(r.avg_cap_rate) || 0,
    buildings: bldgsByOwner.get(r.owner) ?? [],
  }));
}

// ─── Debt Schedule ──────────────────────────────────────────────────────────

export interface DebtMaturity {
  buildingId: string;
  buildingName: string;
  tranche: string;
  amount: number;
  maturityDate: string;
}

export async function getDebtSchedule(): Promise<DebtMaturity[]> {
  const db = await getDb();

  const result = await db.query<{
    building_id: string; name: string;
    senior_loan_amount: string; senior_loan_maturity: string | Date;
    mezz_amount: string | null; mezz_maturity: string | Date | null;
  }>(`
    SELECT b.id as building_id, b.name,
           f.senior_loan_amount::text, f.senior_loan_maturity,
           f.mezz_amount::text, f.mezz_maturity
    FROM buildings b
    JOIN financials f ON f.building_id = b.id
    WHERE f.senior_loan_maturity IS NOT NULL
    ORDER BY f.senior_loan_maturity
  `);

  const maturities: DebtMaturity[] = [];
  for (const row of result.rows) {
    const toDateStr = (v: string | Date) => v instanceof Date ? v.toISOString().split('T')[0] : String(v);

    if (row.senior_loan_amount && row.senior_loan_maturity) {
      maturities.push({
        buildingId: row.building_id,
        buildingName: row.name,
        tranche: 'Senior',
        amount: parseFloat(row.senior_loan_amount),
        maturityDate: toDateStr(row.senior_loan_maturity),
      });
    }

    if (row.mezz_amount && row.mezz_maturity) {
      maturities.push({
        buildingId: row.building_id,
        buildingName: row.name,
        tranche: 'Mezzanine',
        amount: parseFloat(row.mezz_amount),
        maturityDate: toDateStr(row.mezz_maturity),
      });
    }
  }

  return maturities.sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
}

// ─── Single building lookup ─────────────────────────────────────────────────

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
    asOfDate: fin.as_of_date instanceof Date ? fin.as_of_date.toISOString().split('T')[0] : String(fin.as_of_date),
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
        maturityDate: fin.senior_loan_maturity instanceof Date ? fin.senior_loan_maturity.toISOString().split('T')[0] : String(fin.senior_loan_maturity),
      },
      ...(fin.mezz_amount != null && {
        mezz: {
          amount: Number(fin.mezz_amount),
          lender: fin.mezz_lender!,
          interestRate: Number(fin.mezz_rate),
          maturityDate: fin.mezz_maturity instanceof Date ? fin.mezz_maturity.toISOString().split('T')[0] : String(fin.mezz_maturity),
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
