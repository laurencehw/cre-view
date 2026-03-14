/**
 * Seed script: pulls real building data from NYC Open Data PLUTO API
 * and populates the Supabase database with buildings + realistic financials.
 *
 * Usage:  npx ts-node src/db/seed-from-pluto.ts
 */

import 'dotenv/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlutoRecord {
  address: string;
  ownername: string;
  bldgclass: string;
  numfloors: string;
  yearbuilt: string;
  assesstot: string;
  bldgarea: string;
  latitude: string;
  longitude: string;
  lotarea: string;
}

// Well-known building names mapped by address (PLUTO doesn't have names)
const KNOWN_NAMES: Record<string, string> = {
  '185 GREENWICH STREET': 'One World Trade Center',
  '350 5 AVENUE': 'Empire State Building',
  '405 LEXINGTON AVENUE': 'Chrysler Building',
  '432 PARK AVENUE': '432 Park Avenue',
  '270 PARK AVENUE': '270 Park Avenue (JPMorgan HQ)',
  '1111 AVENUE OF THE AMER': 'One Bryant Park (Bank of America Tower)',
  '761 5 AVENUE': 'General Motors Building',
  '427 10 AVENUE': '50 Hudson Yards',
  '1 PENN PLAZA': 'One Penn Plaza',
  '237 PARK AVENUE': '237 Park Avenue',
  '1301 AVENUE OF THE AMER': '1301 Avenue of the Americas',
  '1221 AVENUE OF THE AMER': '1221 Avenue of the Americas (News Corp)',
  '1251 AVENUE OF THE AMER': '1251 Avenue of the Americas',
  '45 ROCKEFELLER PLAZA': '45 Rockefeller Plaza',
  '30 ROCKEFELLER PLAZA': '30 Rockefeller Plaza (30 Rock)',
  '51 WEST 52 STREET': 'CBS Building (Black Rock)',
  '731 LEXINGTON AVENUE': 'Bloomberg Tower',
  '383 MADISON AVENUE': '383 Madison Avenue (Bear Stearns)',
  '388 GREENWICH STREET': 'Citigroup Center (388 Greenwich)',
  '200 LIBERTY STREET': 'Brookfield Place (200 Liberty)',
  '7 WORLD TRADE CENTER': '7 World Trade Center',
  '4 WORLD TRADE CENTER': '4 World Trade Center',
  '3 WORLD TRADE CENTER': '3 World Trade Center',
  '101 PARK AVENUE': '101 Park Avenue',
  '340 MADISON AVENUE': '340 Madison Avenue',
  '375 HUDSON STREET': '375 Hudson Street',
  '195 BROADWAY': '195 Broadway',
  '28 LIBERTY STREET': '28 Liberty Street (One Chase Manhattan)',
  '140 BROADWAY': '140 Broadway',
  '55 WATER STREET': '55 Water Street',
  '60 HUDSON STREET': '60 Hudson Street',
  '399 PARK AVENUE': '399 Park Avenue (Citibank)',
  '300 MADISON AVENUE': '300 Madison Avenue',
  '9 WEST 57 STREET': 'Solow Building',
  '277 PARK AVENUE': '277 Park Avenue',
  '245 PARK AVENUE': '245 Park Avenue',
  '299 PARK AVENUE': '299 Park Avenue',
  '320 PARK AVENUE': '320 Park Avenue',
  '375 PARK AVENUE': 'Seagram Building',
  '390 MADISON AVENUE': '390 Madison Avenue',
  '452 5 AVENUE': '452 Fifth Avenue (NYPL Mid-Manhattan)',
  '200 PARK AVENUE': 'MetLife Building',
  '601 LEXINGTON AVENUE': 'Citigroup Center',
  '1585 BROADWAY': 'Morgan Stanley Building',
  '1515 BROADWAY': '1515 Broadway (Viacom)',
  '4 TIMES SQUARE': '4 Times Square (Condé Nast)',
  '11 TIMES SQUARE': '11 Times Square',
  '1 MANHATTAN WEST': 'One Manhattan West',
  '2 MANHATTAN WEST': 'Two Manhattan West',
  '10 HUDSON YARDS': '10 Hudson Yards',
  '30 HUDSON YARDS': '30 Hudson Yards',
  '55 HUDSON YARDS': '55 Hudson Yards',
  '35 HUDSON YARDS': '35 Hudson Yards',
};

// ---------------------------------------------------------------------------
// PLUTO API fetch
// ---------------------------------------------------------------------------

const PLUTO_BASE = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

async function fetchPlutoBuildings(): Promise<PlutoRecord[]> {
  const fields = 'address,ownername,bldgclass,numfloors,yearbuilt,assesstot,bldgarea,latitude,longitude,lotarea';

  // Fetch large office buildings (O3 = 7-19 floors, O4 = 20+ floors)
  const queries = [
    // Manhattan mega-offices (20+ floors)
    `$where=borough='MN' AND bldgclass='O4' AND numfloors >= 20&$select=${fields}&$order=assesstot DESC&$limit=60`,
    // Manhattan large offices (7-19 floors, large area)
    `$where=borough='MN' AND bldgclass='O3' AND bldgarea >= 300000&$select=${fields}&$order=assesstot DESC&$limit=20`,
    // Manhattan mixed-use towers
    `$where=borough='MN' AND bldgclass IN ('O5','O6','RR') AND numfloors >= 30&$select=${fields}&$order=assesstot DESC&$limit=15`,
  ];

  const allRecords: PlutoRecord[] = [];
  for (const q of queries) {
    const url = `${PLUTO_BASE}?${q}`;
    console.log(`Fetching: ${url.substring(0, 120)}...`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`PLUTO API ${resp.status}: ${await resp.text()}`);
    const data = (await resp.json()) as PlutoRecord[];
    console.log(`  → got ${data.length} records`);
    allRecords.push(...data);
  }

  // Deduplicate by address
  const seen = new Set<string>();
  return allRecords.filter(r => {
    if (!r.latitude || !r.longitude || !r.address) return false;
    const key = r.address.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Realistic financial generation from assessed values
// ---------------------------------------------------------------------------

// CRE lenders active in NYC
const SENIOR_LENDERS = [
  'JPMorgan Chase', 'Wells Fargo', 'Bank of America', 'Goldman Sachs',
  'Morgan Stanley', 'Deutsche Bank', 'Citibank', 'Barclays Capital',
  'HSBC', 'BNP Paribas', 'Credit Suisse (UBS)', 'Canadian Imperial Bank',
  'Aareal Capital', 'Blackstone Mortgage Trust', 'Starwood Capital',
];

const MEZZ_LENDERS = [
  'Apollo Global Management', 'Blackstone Credit', 'Ares Management',
  'KKR Real Estate', 'Brookfield Asset Management', 'Oaktree Capital',
  'Starwood Property Trust', 'Mesa West Capital', 'PGIM Real Estate',
];

const EQUITY_INVESTORS = [
  'Brookfield Properties', 'Blackstone Real Estate', 'Vornado Realty Trust',
  'SL Green Realty', 'Paramount Group', 'RXR Realty', 'Mack Real Estate',
  'Boston Properties', 'Hines', 'Tishman Speyer', 'Silverstein Properties',
  'Related Companies', 'Oxford Properties', 'GIC (Singapore)',
  'Abu Dhabi Investment Authority', 'Norway Government Pension Fund',
  'Canada Pension Plan', 'Qatar Investment Authority', 'Mubadala',
  'Samsung SRA Asset Management', 'NPS (Korea)', 'CalPERS',
  'TIAA-CREF', 'MetLife Investment Management', 'Allianz Real Estate',
];

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

function generateFinancials(buildingId: string, assessedValue: number, primaryUse: string) {
  // NYC assessed values are ~45% of market value for commercial
  const marketMultiplier = randomBetween(2.0, 2.8);
  const estimatedValue = Math.round(assessedValue * marketMultiplier);

  // Cap rates vary by use type
  const capRateRange = primaryUse === 'Residential'
    ? [0.03, 0.045]
    : primaryUse === 'Mixed-Use'
      ? [0.04, 0.055]
      : [0.045, 0.065]; // Office
  const capRate = randomBetween(capRateRange[0], capRateRange[1]);
  const noi = Math.round(estimatedValue * capRate);

  // LTV typically 50-65% for NYC commercial
  const ltv = randomBetween(0.45, 0.65);
  const totalDebt = Math.round(estimatedValue * ltv);

  // Senior loan: 60-80% of total debt
  const seniorPct = randomBetween(0.65, 0.85);
  const seniorAmount = Math.round(totalDebt * seniorPct);
  const seniorRate = randomBetween(0.055, 0.075);
  const seniorMaturityYears = Math.floor(randomBetween(3, 8));
  const seniorMaturity = new Date();
  seniorMaturity.setFullYear(seniorMaturity.getFullYear() + seniorMaturityYears);

  // Mezzanine: remainder (50% chance of having mezz)
  const hasMezz = Math.random() > 0.4;
  const mezzAmount = hasMezz ? totalDebt - seniorAmount : 0;
  const mezzRate = randomBetween(0.085, 0.12);
  const mezzMaturityYears = Math.floor(randomBetween(2, 5));
  const mezzMaturity = new Date();
  mezzMaturity.setFullYear(mezzMaturity.getFullYear() + mezzMaturityYears);

  const totalEquity = estimatedValue - totalDebt;

  // Cap table: 1-4 investors
  const numInvestors = Math.min(Math.floor(randomBetween(1, 5)), 4);
  const investors = pickN(EQUITY_INVESTORS, numInvestors);

  // Generate ownership splits
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

  // Normalize ownership to sum to 1
  const totalOwnership = capTable.reduce((s, e) => s + e.ownership, 0);
  if (totalOwnership !== 1) {
    capTable[capTable.length - 1].ownership = Math.round((capTable[capTable.length - 1].ownership + (1 - totalOwnership)) * 10000) / 10000;
    capTable[capTable.length - 1].amount = Math.round(totalEquity * capTable[capTable.length - 1].ownership);
  }

  return {
    buildingId,
    asOfDate: '2025-01-01',
    estimatedValue,
    currency: 'USD',
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

// ---------------------------------------------------------------------------
// Building class → primary use mapping
// ---------------------------------------------------------------------------

function classifyUse(bldgclass: string): string {
  if (!bldgclass) return 'Office';
  const c = bldgclass.toUpperCase();
  if (c.startsWith('O')) return 'Office';
  if (c.startsWith('R') || c.startsWith('D')) return 'Residential';
  if (c.startsWith('K') || c.startsWith('S')) return 'Mixed-Use';
  if (c.startsWith('E') || c.startsWith('F')) return 'Industrial';
  return 'Mixed-Use';
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatAddress(raw: string): string {
  // PLUTO addresses are like "350 5 AVENUE" — make them readable
  let addr = titleCase(raw.trim());
  // Common NYC abbreviations
  addr = addr.replace(/\bSt\b/g, 'Street')
    .replace(/\bAv\b/g, 'Avenue')
    .replace(/\bAmer\b/g, 'Americas')
    .replace(/\bPl\b/g, 'Plaza');
  return addr + ', New York, NY';
}

// ---------------------------------------------------------------------------
// Database insertion
// ---------------------------------------------------------------------------

async function seed() {
  // Dynamic import of pg
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Connected to database\n');

    // Fetch from PLUTO
    const plutoData = await fetchPlutoBuildings();
    console.log(`\nTotal unique buildings: ${plutoData.length}\n`);

    // Clear existing data (cascade deletes financials + cap table)
    console.log('Clearing existing data...');
    await pool.query('DELETE FROM cap_table_entries');
    await pool.query('DELETE FROM financials');
    await pool.query('DELETE FROM analysis_buildings');
    await pool.query('DELETE FROM analyses');
    await pool.query('DELETE FROM buildings');
    console.log('Done.\n');

    let inserted = 0;
    for (const rec of plutoData) {
      const id = `bld_${String(inserted + 1).padStart(3, '0')}`;
      const name = KNOWN_NAMES[rec.address.trim()] || formatAddress(rec.address);
      const address = formatAddress(rec.address);
      const primaryUse = classifyUse(rec.bldgclass);
      const numfloors = Math.round(parseFloat(rec.numfloors));
      const assessedValue = parseFloat(rec.assesstot);

      // Skip buildings with bad data
      if (!assessedValue || assessedValue < 1000000 || numfloors < 5) continue;

      // Estimate height: ~13ft per floor for office buildings
      const heightFt = Math.round(numfloors * randomBetween(12.5, 14));
      const yearbuilt = parseInt(rec.yearbuilt) || null;
      const owner = titleCase(rec.ownername || 'Unknown');

      // Insert building
      await pool.query(
        `INSERT INTO buildings (id, name, address, latitude, longitude, height_ft, floors, completion_year, primary_use, owner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET name=$2, address=$3, latitude=$4, longitude=$5`,
        [id, name, address, parseFloat(rec.latitude), parseFloat(rec.longitude),
         heightFt, numfloors, yearbuilt, primaryUse, owner],
      );

      // Generate and insert financials
      const fin = generateFinancials(id, assessedValue, primaryUse);
      const finResult = await pool.query(
        `INSERT INTO financials (building_id, as_of_date, estimated_value, currency, cap_rate, noi,
           total_debt, senior_loan_amount, senior_loan_lender, senior_loan_rate, senior_loan_maturity,
           mezz_amount, mezz_lender, mezz_rate, mezz_maturity, total_equity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [fin.buildingId, fin.asOfDate, fin.estimatedValue, fin.currency, fin.capRate, fin.noi,
         fin.totalDebt, fin.seniorLoanAmount, fin.seniorLoanLender, fin.seniorLoanRate, fin.seniorLoanMaturity,
         fin.mezzAmount, fin.mezzLender, fin.mezzRate, fin.mezzMaturity, fin.totalEquity],
      );

      const financialId = finResult.rows[0].id;

      // Insert cap table entries
      for (const entry of fin.capTable) {
        await pool.query(
          `INSERT INTO cap_table_entries (financial_id, investor, ownership, amount)
           VALUES ($1, $2, $3, $4)`,
          [financialId, entry.investor, entry.ownership, entry.amount],
        );
      }

      console.log(`  ${id} | ${name} | ${numfloors}fl | $${(fin.estimatedValue / 1e9).toFixed(2)}B`);
      inserted++;
    }

    console.log(`\n✓ Seeded ${inserted} buildings with financials and cap tables`);

    // Summary stats
    const stats = await pool.query(`
      SELECT
        count(*) as buildings,
        (SELECT count(*) FROM financials) as financials,
        (SELECT count(*) FROM cap_table_entries) as cap_entries,
        round(avg(estimated_value)::numeric / 1e9, 2) as avg_value_bn
      FROM buildings b
      JOIN financials f ON f.building_id = b.id
    `);
    console.log('\nDatabase summary:', stats.rows[0]);

  } finally {
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
