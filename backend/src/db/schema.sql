-- CRE View — PostgreSQL Schema
-- Run against a blank database: psql $DATABASE_URL -f schema.sql

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostGIS is optional and not available on all hosts (e.g. Render free tier)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS not available, skipping';
END $$;

-- ─── Buildings ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buildings (
    id               TEXT        PRIMARY KEY DEFAULT 'bld_' || substr(uuid_generate_v4()::text, 1, 8),
    name             TEXT        NOT NULL,
    address          TEXT        NOT NULL,
    latitude         DOUBLE PRECISION NOT NULL,
    longitude        DOUBLE PRECISION NOT NULL,
    height_ft        INTEGER,
    floors           INTEGER,
    completion_year  INTEGER,
    primary_use      TEXT,                       -- 'Office', 'Residential', 'Mixed-Use', etc.
    owner            TEXT,
    image_url        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_coords
    ON buildings (latitude, longitude);

-- ─── Financials ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financials (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id      TEXT        NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    as_of_date       DATE        NOT NULL,

    -- Valuation
    estimated_value  BIGINT,                     -- USD whole dollars
    currency         CHAR(3)     NOT NULL DEFAULT 'USD',
    cap_rate         NUMERIC(6, 4),
    noi              BIGINT,                     -- USD whole dollars

    -- Debt
    total_debt       BIGINT,
    senior_loan_amount       BIGINT,
    senior_loan_lender       TEXT,
    senior_loan_rate         NUMERIC(6, 4),
    senior_loan_maturity     DATE,
    mezz_amount              BIGINT,
    mezz_lender              TEXT,
    mezz_rate                NUMERIC(6, 4),
    mezz_maturity            DATE,

    -- Equity
    total_equity     BIGINT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (building_id, as_of_date)
);

-- ─── Cap Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cap_table_entries (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_id     UUID        NOT NULL REFERENCES financials(id) ON DELETE CASCADE,
    investor         TEXT        NOT NULL,
    ownership        NUMERIC(5, 4) NOT NULL CHECK (ownership BETWEEN 0 AND 1),
    amount           BIGINT      NOT NULL,       -- USD whole dollars
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id               TEXT        PRIMARY KEY DEFAULT 'usr_' || substr(uuid_generate_v4()::text, 1, 8),
    email            TEXT        NOT NULL UNIQUE,
    password_hash    TEXT        NOT NULL,
    salt             TEXT        NOT NULL,
    role             TEXT        NOT NULL DEFAULT 'user',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Analyses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
    id               TEXT        PRIMARY KEY DEFAULT 'ana_' || substr(uuid_generate_v4()::text, 1, 8),
    image_filename   TEXT        NOT NULL,
    image_url        TEXT,
    latitude         DOUBLE PRECISION,
    longitude        DOUBLE PRECISION,
    heading          DOUBLE PRECISION,
    raw_vision_response JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_buildings (
    analysis_id      TEXT        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    building_id      TEXT        NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    confidence       NUMERIC(4, 3),
    bounding_box     JSONB,
    PRIMARY KEY (analysis_id, building_id)
);

-- ─── Watchlist ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_items (
    user_id          TEXT        NOT NULL,
    building_id      TEXT        NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, building_id)
);

-- ─── Saved Searches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_searches (
    id               TEXT        PRIMARY KEY DEFAULT 'ss_' || substr(uuid_generate_v4()::text, 1, 8),
    user_id          TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    filters          JSONB       NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user
    ON saved_searches (user_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER buildings_updated_at
    BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER financials_updated_at
    BEFORE UPDATE ON financials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
