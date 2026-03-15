# CRE View — Project Instructions

## What This Is
Commercial real estate skyline analysis app. Upload a photo of a city skyline → vision API identifies buildings → displays financial data (valuation, debt structure, cap table).

Live at: https://creview-app.onrender.com/

## Architecture
- **Frontend**: Next.js 14 (App Router) + React 18 + Tailwind CSS, port 3000
- **Backend**: Express 4 + TypeScript, port 4000
- **Database**: Supabase PostgreSQL (475 buildings across 7+ cities)
- **Auth**: Supabase Auth + custom JWT fallback
- **Vision**: Pluggable provider pattern — OpenAI GPT-4o (active, city-aware), mock, Azure/GCP stubs
- **Monorepo**: npm workspaces (root `package.json`)
- **Data sources**: NYC PLUTO API (live), OpenStreetMap Overpass (seed), SEC EDGAR REIT 10-Ks (seed)

## Key Commands
```bash
npm install                          # Install all dependencies
npm run dev                          # Start both frontend + backend (concurrently)
npm run build --workspace=backend    # Build backend
npm run build --workspace=frontend   # Build frontend
npm test --workspace=backend         # Backend tests (Jest + Supertest)
npm test --workspace=frontend        # Frontend tests (Jest + RTL)
npm run type-check --workspace=frontend  # TypeScript check

# Seed scripts (run from project root)
npx ts-node backend/src/db/seed-from-pluto.ts    # Seed NYC buildings from PLUTO API
npx ts-node backend/src/db/seed-multi-city.ts     # Add Chicago, LA, SF via Overpass

# REIT data pipeline (requires edgartools + Gemini)
python backend/scripts/extract_reit_properties.py  # Download 10-K Item 2 text
python backend/scripts/parse_reit_with_gemini.py    # Parse with Gemini → JSON
python backend/scripts/seed_reit_data.py            # Generate Node seed script
node backend/scripts/reit_data/_seed_reit.js        # Seed REIT data into DB
```

## Key Files
- `backend/src/index.ts` — Express entry point (loads .env from project root, SPA fallback for client-side routing)
- `backend/src/routes/analyze.ts` — POST /api/analyze-skyline (image upload + vision)
- `backend/src/routes/buildings.ts` — Building CRUD + financials + comps + CSV export
- `backend/src/routes/analytics.ts` — Market summary + portfolio aggregation endpoints
- `backend/src/routes/nycData.ts` — NYC Open Data search + import endpoints
- `backend/src/routes/auth.ts` — Supabase + JWT auth routes
- `backend/src/services/nycOpenData.ts` — PLUTO + ACRIS query service
- `backend/src/services/vision.ts` — Vision provider factory
- `backend/src/services/supabase.ts` — Supabase admin/anon clients
- `backend/src/db/connection.ts` — PostgreSQL connection (SSL for Supabase, mock fallback)
- `backend/src/db/repositories.ts` — Data access layer (listBuildings with filters, comps, market summary, portfolios)
- `backend/src/db/schema.sql` — PostgreSQL DDL
- `backend/src/db/seed-from-pluto.ts` — NYC PLUTO seed script (69 Manhattan buildings)
- `backend/src/db/seed-multi-city.ts` — Multi-city seed (Chicago, LA, SF via Overpass)
- `backend/src/data/mockData.ts` — Mock data fallback (used when DB unavailable)
- `backend/scripts/extract_reit_properties.py` — Pull Item 2 from REIT 10-Ks via edgartools
- `backend/scripts/parse_reit_with_gemini.py` — Parse 10-K property tables with Gemini
- `backend/scripts/seed_reit_data.py` — Generate Node.js DB seed script from parsed REIT data
- `frontend/app/page.tsx` — Home page (skyline analysis)
- `frontend/app/buildings/page.tsx` — Building search + detail page (handles /buildings and /buildings/:id)
- `frontend/app/analytics/page.tsx` — Market analytics dashboard
- `frontend/components/NavBar.tsx` — Top navigation with client-side routing
- `frontend/components/BuildingGrid.tsx` — Paginated grid of building summary cards
- `frontend/components/BuildingSearchFilters.tsx` — Search + filter controls (city, type, floors, sort)
- `frontend/components/BuildingDetailTabs.tsx` — Tabbed building detail (overview, financials, ownership, location)
- `frontend/components/CompsTable.tsx` — Comparable buildings side-by-side table
- `frontend/components/InteractiveMap.tsx` — Leaflet map with dark CARTO tiles and custom markers
- `frontend/components/MarketCharts.tsx` — SVG bar/donut charts for analytics
- `frontend/components/MortgageHistory.tsx` — ACRIS mortgage/deed history for NYC buildings
- `frontend/components/FinancialPanel.tsx` — Debt table, cap table, KPIs
- `frontend/lib/types.ts` — Shared TypeScript interfaces
- `frontend/lib/api.ts` — PaginatedResult type
- `frontend/lib/supabase.ts` — Frontend Supabase client
- `frontend/lib/auth.tsx` — Auth context with Supabase + JWT fallback

## Environment Variables
All in `.env` at project root (gitignored). Key vars:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase auth
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Frontend Supabase
- `DATABASE_URL` — Supabase Postgres connection (URL-encode special chars in password)
- `OPENAI_API_KEY` — Vision API
- `VISION_PROVIDER` — `openai` (active) or `mock`
- `NYC_OPEN_DATA_APP_TOKEN` — Optional, for higher rate limits on NYC API

## API Endpoints
- `GET /api/buildings` — List buildings (paginated, search, city/type/floors filters, sort)
- `GET /api/buildings/filters` — Distinct cities + property types for filter dropdowns
- `GET /api/buildings/:id` — Building details
- `GET /api/buildings/:id/comps` — Comparable buildings (same type ± 20% floors)
- `GET /api/buildings/:id/financials` — Financial data (auth required)
- `GET /api/buildings/:id/financials/export` — CSV export (auth required)
- `GET /api/analytics/market-summary` — Aggregate stats by city and property type
- `GET /api/analytics/portfolios` — Owner portfolios (2+ buildings, ranked by value)
- `POST /api/analyze-skyline` — Upload image for building detection
- `GET /api/nyc/pluto/search` — Live search NYC PLUTO data
- `POST /api/nyc/import` — Import PLUTO buildings to DB (auth required)
- `GET /api/nyc/acris/search` — ACRIS mortgage/deed lookup (auth required)
- `POST /api/auth/register`, `POST /api/auth/login` — Auth endpoints
- `GET /api/health` — Health check

## Current State
- **Database**: Supabase PostgreSQL with 475 buildings across NYC, LA, SF, Chicago, San Diego, Seattle, and more
- **Data**: Real building characteristics from NYC PLUTO + OpenStreetMap + SEC EDGAR REIT 10-Ks
- **Cap tables**: Real REIT ownership from 10-K filings for ~150 buildings; major iconic buildings hand-verified
- **Vision**: OpenAI GPT-4o with city detection + geolocation-aware matching
- **Auth**: Supabase Auth integrated (frontend + backend), JWT fallback for non-Supabase deployments
- **Navigation**: Multi-page SPA — Skyline (home), Buildings (search/detail), Analytics (dashboard)
- **Search**: Full-text search + city/type/floor filters + sorting + pagination
- **Building detail**: Tabbed view (overview, financials, ownership pie chart, location map)
- **Comps**: Comparable buildings matched by type and floor count with financial comparison
- **Interactive map**: Leaflet with dark CARTO tiles, custom markers, popups (on analytics + detail pages)
- **Analytics**: Market summary by city/type, portfolio rankings, SVG charts
- **ACRIS**: NYC mortgage/deed history auto-lookup on building detail pages
- **Deployment**: Render (Express serves static frontend with SPA fallback, Supabase Postgres via pooler)

## Roadmap
- [ ] DCF/IRR calculator (pure frontend, pre-populated from building data)
- [ ] Debt maturity schedule (portfolio-wide timeline from existing maturity dates)
- [ ] Shareable deal sheet PDF export
- [ ] **More REITs**: Add BXP (Boston Properties ~50 buildings), DEI (Douglas Emmett ~40 LA), Hines, CBRE, Prologis. Re-run pipeline.
- [ ] Building images (Google Street View Static API, image_url column exists)
- [ ] Data trust labels (tag financial records as "SEC Filing" vs "Market Estimate")
- [ ] Cook County Assessor API for Chicago (dataset: csik-bsws — has NOI, cap rates)
- [ ] DC CAMA integration (ArcGIS REST API — commercial property assessments)
- [ ] AI document extraction (upload offering memorandum → auto-create building)
- [ ] Saved searches & watchlists
