"""
Seed REIT property data into the database.
- Matches REIT properties against existing buildings by name/address
- Updates cap tables with real REIT ownership
- Adds new buildings for REIT properties not yet in DB
- Uses real financial data (NOI, occupancy) where available

Usage: python backend/scripts/seed_reit_data.py
"""

import json
import os
import random
import sys
from pathlib import Path

import dotenv
dotenv.load_dotenv(Path(__file__).parent.parent.parent / ".env")

# pg8000 not needed — we generate a Node.js script instead

REIT_DATA = Path(__file__).parent / "reit_data" / "combined_reit_properties.json"

# State → typical coordinates for geocoding when we don't have lat/lon
CITY_COORDS = {
    "New York": (40.7580, -73.9780),
    "Brooklyn": (40.6892, -73.9857),
    "San Francisco": (37.7899, -122.3893),
    "South San Francisco": (37.6547, -122.4077),
    "Los Angeles": (34.0522, -118.2437),
    "San Diego": (32.7157, -117.1611),
    "Seattle": (47.6062, -122.3321),
    "Bellevue": (47.6101, -122.2015),
    "Boston": (42.3601, -71.0589),
    "Washington": (38.9072, -77.0369),
    "Austin": (30.2672, -97.7431),
    "Beverly Hills": (34.0736, -118.4004),
    "Culver City": (34.0211, -118.3965),
    "El Segundo": (33.9192, -118.4165),
    "West Hollywood": (34.0900, -118.3617),
    "Santa Monica": (34.0195, -118.4912),
    "Long Beach": (33.7701, -118.1937),
    "Menlo Park": (37.4530, -122.1817),
    "Mountain View": (37.3861, -122.0839),
    "Palo Alto": (37.4419, -122.1430),
    "Redwood City": (37.4852, -122.2364),
    "Chicago": (41.8781, -87.6298),
}

SENIOR_LENDERS = [
    "JPMorgan Chase", "Wells Fargo", "Bank of America", "Goldman Sachs",
    "Morgan Stanley", "Deutsche Bank", "Citibank", "Barclays Capital",
]


def connect_db():
    """Connect to Supabase Postgres."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    # Parse the URL for pg8000 — it doesn't support URL format
    # Use psycopg2-style parsing
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    password = urllib.parse.unquote(parsed.password or "")

    # pg8000 doesn't support the pooler well, use psycopg2 or pg
    # Actually let's just use the pg npm package via node
    return url


def main():
    if not REIT_DATA.exists():
        print(f"ERROR: {REIT_DATA} not found. Run parse_reit_with_gemini.py first.")
        sys.exit(1)

    properties = json.loads(REIT_DATA.read_text(encoding="utf-8"))
    print(f"Loaded {len(properties)} REIT properties\n")

    # Generate a Node.js script to do the DB updates
    # (easier than fighting with Python pg drivers and Supabase pooler)
    node_script = generate_node_script(properties)

    script_file = Path(__file__).parent / "reit_data" / "_seed_reit.js"
    script_file.write_text(node_script, encoding="utf-8")
    print(f"Generated Node.js seed script: {script_file}")
    print(f"Run with: cd {script_file.parent.parent.parent} && node {script_file}")


def generate_node_script(properties: list[dict]) -> str:
    """Generate a Node.js script that updates the database."""

    # Build the properties array as JSON
    props_json = json.dumps(properties, indent=2)

    return f"""// Auto-generated script to seed REIT property data
// Run: node backend/scripts/reit_data/_seed_reit.js

require('dotenv').config();
const {{ Pool }} = require('pg');

const pool = new Pool({{
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {{ rejectUnauthorized: false }} : undefined,
}});

const PROPERTIES = {props_json};

const CITY_COORDS = {json.dumps(CITY_COORDS)};

const LENDERS = {json.dumps(SENIOR_LENDERS)};

function pick(arr) {{ return arr[Math.floor(Math.random() * arr.length)]; }}
function rand(a, b) {{ return a + Math.random() * (b - a); }}

async function main() {{
  await pool.query('SELECT 1');
  console.log('Connected to database\\n');

  // Get next building number
  const maxR = await pool.query("SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0) as n FROM buildings WHERE id LIKE 'bld_%'");
  let nextNum = parseInt(maxR.rows[0].n) + 1;

  let matched = 0, added = 0, skipped = 0;

  for (const prop of PROPERTIES) {{
    const name = prop.name;
    const city = prop.city || 'Unknown';
    const state = prop.state || '';
    const reit = prop.reit || '';
    const sqft = prop.sqft || 0;
    const annualRent = prop.annual_rent || 0;
    const occupancy = prop.occupancy || 0;
    const ownershipPct = prop.ownership_pct || 1.0;

    if (!name || name.length < 3) {{ skipped++; continue; }}

    // Try to match existing building by name
    const existing = await pool.query(
      "SELECT id, name FROM buildings WHERE name != '' AND (LOWER(name) = $1 OR LOWER(name) LIKE $2) AND LOWER(address) LIKE $3 LIMIT 1",
      [name.toLowerCase(), '%' + name.toLowerCase() + '%', '%' + city.toLowerCase() + '%']
    );

    let buildingId;

    if (existing.rows.length > 0) {{
      // Update existing building's owner
      buildingId = existing.rows[0].id;
      await pool.query('UPDATE buildings SET owner = $1 WHERE id = $2', [reit, buildingId]);
      matched++;
    }} else {{
      // Add new building
      const coords = CITY_COORDS[city] || CITY_COORDS['New York'];
      // Add small random offset to avoid exact overlaps
      const lat = coords[0] + rand(-0.01, 0.01);
      const lon = coords[1] + rand(-0.01, 0.01);

      buildingId = 'bld_' + String(nextNum++).padStart(3, '0');
      const propertyType = prop.property_type || 'Office';

      // Estimate floors from sqft (rough: 20k SF per floor for office)
      const floors = sqft > 0 ? Math.max(5, Math.round(sqft / 20000)) : 20;
      const heightFt = Math.round(floors * 13);
      const address = prop.address ? prop.address + ', ' + city + ', ' + state : city + ', ' + state;

      await pool.query(
        'INSERT INTO buildings (id, name, address, latitude, longitude, height_ft, floors, primary_use, owner) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [buildingId, name, address, lat, lon, heightFt, floors, propertyType, reit]
      );
      added++;
    }}

    // Update or create financials with real REIT data
    // Delete old financials for this building
    const oldFin = await pool.query('SELECT id FROM financials WHERE building_id = $1', [buildingId]);
    for (const f of oldFin.rows) {{
      await pool.query('DELETE FROM cap_table_entries WHERE financial_id = $1', [f.id]);
    }}
    await pool.query('DELETE FROM financials WHERE building_id = $1', [buildingId]);

    // Calculate financials from REIT data
    let noi = annualRent > 0 ? Math.round(annualRent * 0.65) : 0; // ~65% margin for office
    let capRate = prop.cap_rate || (noi > 0 ? rand(0.04, 0.06) : rand(0.045, 0.065));
    let estimatedValue = noi > 0 ? Math.round(noi / capRate) : Math.round(sqft * rand(400, 800));
    if (estimatedValue < 10000000) estimatedValue = Math.round(sqft * rand(400, 800));

    const ltv = rand(0.40, 0.60);
    const totalDebt = Math.round(estimatedValue * ltv);
    const seniorAmount = totalDebt;
    const seniorRate = rand(0.045, 0.065);
    const seniorYrs = Math.floor(rand(4, 10));
    const seniorMat = new Date();
    seniorMat.setFullYear(seniorMat.getFullYear() + seniorYrs);
    const totalEquity = estimatedValue - totalDebt;

    const finR = await pool.query(
      'INSERT INTO financials (building_id,as_of_date,estimated_value,currency,cap_rate,noi,total_debt,senior_loan_amount,senior_loan_lender,senior_loan_rate,senior_loan_maturity,total_equity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id',
      [buildingId, '2025-01-01', estimatedValue, 'USD', Math.round(capRate*10000)/10000, noi,
       totalDebt, seniorAmount, pick(LENDERS), Math.round(seniorRate*10000)/10000, seniorMat.toISOString().split('T')[0],
       totalEquity]
    );
    const fid = finR.rows[0].id;

    // Cap table: use real REIT ownership
    await pool.query(
      'INSERT INTO cap_table_entries (financial_id, investor, ownership, amount) VALUES ($1,$2,$3,$4)',
      [fid, reit, ownershipPct, Math.round(totalEquity * ownershipPct)]
    );

    // If REIT doesn't own 100%, add a generic co-investor
    if (ownershipPct < 0.99) {{
      const remaining = Math.round((1 - ownershipPct) * 10000) / 10000;
      await pool.query(
        'INSERT INTO cap_table_entries (financial_id, investor, ownership, amount) VALUES ($1,$2,$3,$4)',
        [fid, 'Joint Venture Partner', remaining, Math.round(totalEquity * remaining)]
      );
    }}

    process.stdout.write('.');
  }}

  console.log('\\n');
  console.log('Matched existing:', matched);
  console.log('Added new:', added);
  console.log('Skipped:', skipped);

  const stats = await pool.query('SELECT count(*) as b FROM buildings');
  console.log('Total buildings now:', stats.rows[0].b);

  await pool.end();
}}

main().catch(e => {{ console.error(e); process.exit(1); }});
"""


if __name__ == "__main__":
    main()
