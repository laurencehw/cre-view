/**
 * Multi-city seed script: pulls real building data from OpenStreetMap
 * Overpass API for Chicago, Washington DC, Los Angeles, and San Francisco.
 *
 * Run AFTER seed-from-pluto.ts (which handles NYC).
 * Usage: npx ts-node src/db/seed-multi-city.ts
 *
 * Appends buildings to the existing database — does not clear NYC data.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
dotenv.config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverpassElement {
  type: string;
  id: number;
  center?: { lat: number; lon: number };
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface CityConfig {
  name: string;
  state: string;
  overpassArea: string;
  minLevels: number;
  buildingTypes: string[];
}

// ---------------------------------------------------------------------------
// City configurations
// ---------------------------------------------------------------------------

const CITIES: CityConfig[] = [
  {
    name: 'Chicago',
    state: 'IL',
    overpassArea: 'Chicago',
    minLevels: 20,
    buildingTypes: ['commercial', 'office', 'apartments', 'hotel'],
  },
  {
    name: 'Washington',
    state: 'DC',
    overpassArea: 'Washington',
    minLevels: 8, // DC has height restrictions — lower threshold
    buildingTypes: ['commercial', 'office', 'government'],
  },
  {
    name: 'Los Angeles',
    state: 'CA',
    overpassArea: 'Los Angeles',
    minLevels: 20,
    buildingTypes: ['commercial', 'office', 'apartments'],
  },
  {
    name: 'San Francisco',
    state: 'CA',
    overpassArea: 'San Francisco',
    minLevels: 15,
    buildingTypes: ['commercial', 'office', 'apartments'],
  },
];

// ---------------------------------------------------------------------------
// Known building names (Overpass sometimes has them, sometimes doesn't)
// ---------------------------------------------------------------------------

const KNOWN_CHICAGO: Record<string, { name: string; assessedValue: number }> = {
  'Willis Tower': { name: 'Willis Tower', assessedValue: 650_000_000 },
  'Aon Center': { name: 'Aon Center', assessedValue: 400_000_000 },
  '875 N Michigan': { name: '875 North Michigan (John Hancock Center)', assessedValue: 350_000_000 },
  'Two Prudential Plaza': { name: 'Two Prudential Plaza', assessedValue: 200_000_000 },
  'Chase Tower': { name: 'Chase Tower', assessedValue: 300_000_000 },
  'Trump International Hotel and Tower': { name: 'Trump International Hotel & Tower', assessedValue: 400_000_000 },
  'Salesforce Tower Chicago': { name: 'Salesforce Tower Chicago', assessedValue: 250_000_000 },
  'Chicago Board of Trade Building': { name: 'Chicago Board of Trade Building', assessedValue: 150_000_000 },
  'One Museum Park': { name: 'One Museum Park', assessedValue: 200_000_000 },
  'Aqua': { name: 'Aqua Tower', assessedValue: 180_000_000 },
  'Vista Tower': { name: 'St. Regis Chicago (Vista Tower)', assessedValue: 350_000_000 },
};

// ---------------------------------------------------------------------------
// Overpass API
// ---------------------------------------------------------------------------

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function fetchOverpassBuildings(city: CityConfig): Promise<OverpassElement[]> {
  const typeFilters = city.buildingTypes
    .map(
      (t) =>
        `way["building"="${t}"]["building:levels"](if:t["building:levels"]>=${city.minLevels})(area.searchArea);`,
    )
    .join('\n');

  // Also grab named tall buildings regardless of type
  const namedFilter = `way["building"]["name"]["building:levels"](if:t["building:levels"]>=${city.minLevels})(area.searchArea);`;

  const query = `
    [out:json][timeout:30];
    area["name"="${city.overpassArea}"]["admin_level"~"^[68]$"]->.searchArea;
    (
      ${typeFilters}
      ${namedFilter}
    );
    out center body 100;
  `;

  console.log(`  Querying Overpass for ${city.name}...`);
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`  Overpass error for ${city.name}: ${resp.status} ${text.substring(0, 200)}`);
    return [];
  }

  const data = (await resp.json()) as { elements: OverpassElement[] };
  return data.elements ?? [];
}

// ---------------------------------------------------------------------------
// Shared financial generation (same logic as seed-from-pluto)
// ---------------------------------------------------------------------------

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateFinancials(buildingId: string, assessedValue: number, primaryUse: string) {
  const marketMult = rand(2.0, 2.8);
  const estimatedValue = Math.round(assessedValue * marketMult);
  const capRateRange =
    primaryUse === 'Residential' ? [0.03, 0.045] :
    primaryUse === 'Hotel' ? [0.055, 0.08] :
    primaryUse === 'Mixed-Use' ? [0.04, 0.055] :
    [0.045, 0.065];
  const capRate = rand(capRateRange[0], capRateRange[1]);
  const noi = Math.round(estimatedValue * capRate);
  const ltv = rand(0.45, 0.65);
  const totalDebt = Math.round(estimatedValue * ltv);
  const seniorPct = rand(0.65, 0.85);
  const seniorAmount = Math.round(totalDebt * seniorPct);
  const seniorRate = rand(0.055, 0.075);
  const seniorYrs = Math.floor(rand(3, 8));
  const seniorMat = new Date();
  seniorMat.setFullYear(seniorMat.getFullYear() + seniorYrs);

  const hasMezz = Math.random() > 0.4;
  const mezzAmt = hasMezz ? totalDebt - seniorAmount : 0;
  const mezzRate = rand(0.085, 0.12);
  const mezzYrs = Math.floor(rand(2, 5));
  const mezzMat = new Date();
  mezzMat.setFullYear(mezzMat.getFullYear() + mezzYrs);

  const totalEquity = estimatedValue - totalDebt;
  const numInv = Math.min(Math.floor(rand(1, 5)), 4);
  const investors = pickN(EQUITY_INVESTORS, numInv);

  let remaining = 1.0;
  const capTable = investors.map((investor, i) => {
    const isLast = i === investors.length - 1;
    const ownership = isLast
      ? Math.round(remaining * 10000) / 10000
      : Math.round(rand(0.15, remaining - 0.1 * (investors.length - i - 1)) * 10000) / 10000;
    remaining -= ownership;
    return { investor, ownership: Math.max(0.01, ownership), amount: Math.round(totalEquity * ownership) };
  });

  const total = capTable.reduce((s, e) => s + e.ownership, 0);
  if (total !== 1) {
    capTable[capTable.length - 1].ownership = Math.round((capTable[capTable.length - 1].ownership + (1 - total)) * 10000) / 10000;
    capTable[capTable.length - 1].amount = Math.round(totalEquity * capTable[capTable.length - 1].ownership);
  }

  return {
    buildingId, estimatedValue,
    capRate: Math.round(capRate * 10000) / 10000, noi, totalDebt,
    seniorLoanAmount: seniorAmount, seniorLoanLender: pick(SENIOR_LENDERS),
    seniorLoanRate: Math.round(seniorRate * 10000) / 10000,
    seniorLoanMaturity: seniorMat.toISOString().split('T')[0],
    mezzAmount: hasMezz ? mezzAmt : null, mezzLender: hasMezz ? pick(MEZZ_LENDERS) : null,
    mezzRate: hasMezz ? Math.round(mezzRate * 10000) / 10000 : null,
    mezzMaturity: hasMezz ? mezzMat.toISOString().split('T')[0] : null,
    totalEquity, capTable,
  };
}

// ---------------------------------------------------------------------------
// Classify OSM building type
// ---------------------------------------------------------------------------

function classifyUse(tags: Record<string, string>): string {
  const btype = (tags.building ?? '').toLowerCase();
  if (btype === 'hotel' || tags.tourism === 'hotel') return 'Hotel';
  if (btype === 'apartments' || btype === 'residential') return 'Residential';
  if (btype === 'government') return 'Government';
  if (btype === 'office') return 'Office';
  return 'Mixed-Use';
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to database\n');

    // Get current max building number for ID generation
    const maxResult = await pool.query<{ max_num: string }>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0) as max_num FROM buildings WHERE id LIKE 'bld_%'`,
    );
    let nextNum = parseInt(maxResult.rows[0]?.max_num ?? '0') + 1;

    let totalInserted = 0;

    for (const city of CITIES) {
      console.log(`\n=== ${city.name}, ${city.state} ===`);
      const elements = await fetchOverpassBuildings(city);
      console.log(`  Found ${elements.length} buildings from Overpass`);

      let cityInserted = 0;
      const seen = new Set<string>();

      for (const el of elements) {
        const lat = el.center?.lat ?? el.lat;
        const lon = el.center?.lon ?? el.lon;
        if (!lat || !lon) continue;

        const tags = el.tags ?? {};
        const name = tags.name ?? '';
        const levels = parseInt(tags['building:levels'] ?? '0');
        if (levels < city.minLevels) continue;

        // Build address
        const street = tags['addr:street'] ?? '';
        const houseNum = tags['addr:housenumber'] ?? '';
        const address = street
          ? `${houseNum} ${street}, ${city.name}, ${city.state}`.trim()
          : `${city.name}, ${city.state}`;

        // Dedup by name or coordinates
        const dedupKey = name || `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        // Check if already in DB (by coordinates)
        const existing = await pool.query(
          `SELECT id FROM buildings WHERE ABS(latitude - $1) < 0.0005 AND ABS(longitude - $2) < 0.0005 LIMIT 1`,
          [lat, lon],
        );
        if (existing.rows.length > 0) continue;

        const id = `bld_${String(nextNum).padStart(3, '0')}`;
        nextNum++;

        const primaryUse = classifyUse(tags);
        const heightFt = Math.round(levels * 13);
        const yearBuilt = parseInt(tags.start_date ?? tags['building:start_date'] ?? '0') || null;
        const owner = tags.operator ?? tags.owner ?? 'Unknown';

        // Estimate assessed value from floor count and city
        // Rough heuristic: NYC is ~$10M/floor for prime office, Chicago ~$6M, DC ~$8M, etc.
        const knownInfo = name ? KNOWN_CHICAGO[name] : undefined;
        const perFloorValue =
          city.name === 'Chicago' ? 6_000_000 :
          city.name === 'Washington' ? 8_000_000 :
          city.name === 'Los Angeles' ? 5_000_000 :
          city.name === 'San Francisco' ? 9_000_000 :
          5_000_000;
        const assessedValue = knownInfo?.assessedValue ?? Math.round(levels * perFloorValue * rand(0.6, 1.4));

        const displayName = knownInfo?.name ?? name ?? address;

        await pool.query(
          `INSERT INTO buildings (id, name, address, latitude, longitude, height_ft, floors, completion_year, primary_use, owner)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [id, displayName, address, lat, lon, heightFt, levels, yearBuilt, primaryUse, titleCase(owner)],
        );

        const fin = generateFinancials(id, assessedValue, primaryUse);
        const finResult = await pool.query<{ id: string }>(
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
            await pool.query(
              `INSERT INTO cap_table_entries (financial_id, investor, ownership, amount) VALUES ($1, $2, $3, $4)`,
              [financialId, entry.investor, entry.ownership, entry.amount],
            );
          }
        }

        console.log(`  ${id} | ${displayName} | ${levels}fl | $${(fin.estimatedValue / 1e9).toFixed(2)}B`);
        cityInserted++;
      }

      console.log(`  → Inserted ${cityInserted} buildings for ${city.name}`);
      totalInserted += cityInserted;
    }

    console.log(`\n✓ Total new buildings added: ${totalInserted}`);

    const stats = await pool.query(`
      SELECT count(*) as buildings,
        (SELECT count(*) FROM financials) as financials,
        (SELECT count(*) FROM cap_table_entries) as cap_entries
      FROM buildings
    `);
    console.log('Database totals:', stats.rows[0]);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
