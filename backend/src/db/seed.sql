-- CRE View — Seed Data
-- Run after schema.sql: psql $DATABASE_URL -f seed.sql
-- Mirrors the mock data from backend/src/data/mockData.ts

-- ─── Buildings ───────────────────────────────────────────────────────────────

INSERT INTO buildings (id, name, address, latitude, longitude, height_ft, floors, completion_year, primary_use, owner)
VALUES
  ('bld_001', 'Empire State Building',    '350 Fifth Avenue, New York, NY 10118',    40.748817, -73.985428, 1454, 102, 1931, 'Mixed-Use',   'Empire State Realty Trust'),
  ('bld_002', 'One World Trade Center',   '285 Fulton St, New York, NY 10007',       40.712743, -74.013382, 1776, 104, 2014, 'Office',      'Port Authority of NY & NJ'),
  ('bld_003', 'Chrysler Building',        '405 Lexington Avenue, New York, NY 10174', 40.751652, -73.975311, 1046,  77, 1930, 'Office',      'RFR Holding'),
  ('bld_004', '432 Park Avenue',          '432 Park Avenue, New York, NY 10022',      40.761587, -73.971639, 1396,  96, 2015, 'Residential', 'CIM Group / Macklowe Properties'),
  ('bld_005', 'Willis Tower',             '233 S Wacker Dr, Chicago, IL 60606',       41.878872, -87.635908, 1451, 108, 1973, 'Office',      'Blackstone Real Estate Partners')
ON CONFLICT (id) DO NOTHING;

-- ─── Financials ──────────────────────────────────────────────────────────────

INSERT INTO financials (id, building_id, as_of_date, estimated_value, currency, cap_rate, noi, total_debt, senior_loan_amount, senior_loan_lender, senior_loan_rate, senior_loan_maturity, mezz_amount, mezz_lender, mezz_rate, mezz_maturity, total_equity)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'bld_001', '2024-01-01',
   2100000000, 'USD', 0.0450, 94500000,
   1200000000, 900000000, 'Goldman Sachs Mortgage', 0.0620, '2028-06-01',
   300000000, 'Blackstone Credit', 0.0950, '2026-12-01',
   900000000),

  ('00000000-0000-0000-0000-000000000002', 'bld_002', '2024-01-01',
   3500000000, 'USD', 0.0400, 140000000,
   1800000000, 1800000000, 'NY State Urban Development Corp', 0.0550, '2034-01-01',
   NULL, NULL, NULL, NULL,
   1700000000),

  ('00000000-0000-0000-0000-000000000003', 'bld_003', '2024-01-01',
   800000000, 'USD', 0.0500, 40000000,
   500000000, 500000000, 'Deutsche Bank AG', 0.0700, '2027-03-15',
   NULL, NULL, NULL, NULL,
   300000000),

  ('00000000-0000-0000-0000-000000000004', 'bld_004', '2024-01-01',
   1250000000, 'USD', 0.0320, 40000000,
   700000000, 700000000, 'Wells Fargo Bank', 0.0680, '2029-09-01',
   NULL, NULL, NULL, NULL,
   550000000),

  ('00000000-0000-0000-0000-000000000005', 'bld_005', '2024-01-01',
   1300000000, 'USD', 0.0600, 78000000,
   800000000, 600000000, 'JPMorgan Chase Bank', 0.0580, '2030-11-01',
   200000000, 'Apollo Global Management', 0.1000, '2028-11-01',
   500000000)
ON CONFLICT (building_id, as_of_date) DO NOTHING;

-- ─── Cap Table Entries ───────────────────────────────────────────────────────

INSERT INTO cap_table_entries (financial_id, investor, ownership, amount)
VALUES
  -- Empire State Building
  ('00000000-0000-0000-0000-000000000001', 'Empire State Realty Trust',      0.5500, 495000000),
  ('00000000-0000-0000-0000-000000000001', 'Sovereign Wealth Fund A',       0.3000, 270000000),
  ('00000000-0000-0000-0000-000000000001', 'Family Office B',               0.1500, 135000000),

  -- One World Trade Center
  ('00000000-0000-0000-0000-000000000002', 'Port Authority of NY & NJ',     1.0000, 1700000000),

  -- Chrysler Building
  ('00000000-0000-0000-0000-000000000003', 'RFR Holding LLC',               0.8000, 240000000),
  ('00000000-0000-0000-0000-000000000003', 'Abu Dhabi Investment Authority', 0.2000, 60000000),

  -- 432 Park Avenue
  ('00000000-0000-0000-0000-000000000004', 'CIM Group',                     0.6000, 330000000),
  ('00000000-0000-0000-0000-000000000004', 'Macklowe Properties',           0.4000, 220000000),

  -- Willis Tower
  ('00000000-0000-0000-0000-000000000005', 'Blackstone Real Estate Partners', 0.7500, 375000000),
  ('00000000-0000-0000-0000-000000000005', 'Canada Pension Plan',            0.2500, 125000000);
