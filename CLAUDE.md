# CRE View — Project Instructions

## What This Is
Commercial real estate skyline analysis app. Upload a photo of a city skyline → vision API identifies buildings → displays financial data (valuation, debt structure, cap table).

## Architecture
- **Frontend**: Next.js 14 (App Router) + React 18 + Tailwind CSS, port 3000
- **Backend**: Express 4 + TypeScript, port 4000
- **Database**: PostgreSQL schema exists but currently uses mock data (5 NYC/Chicago buildings)
- **Vision**: Pluggable provider pattern — mock (default), Azure/GCP stubs
- **Monorepo**: npm workspaces (root `package.json`)

## Key Commands
```bash
npm install                          # Install all dependencies
npm run dev                          # Start both frontend + backend
npm run build --workspace=backend    # Build backend
npm run build --workspace=frontend   # Build frontend
npm test --workspace=backend         # Backend tests (Jest + Supertest)
npm test --workspace=frontend        # Frontend tests (Jest + RTL)
npm run type-check --workspace=frontend  # TypeScript check
```

## Key Files
- `backend/src/index.ts` — Express entry point
- `backend/src/routes/analyze.ts` — POST /api/analyze-skyline (image upload)
- `backend/src/routes/buildings.ts` — Building CRUD + financials + CSV export
- `backend/src/services/vision.ts` — Vision provider factory
- `backend/src/data/mockData.ts` — 5 hardcoded buildings with financials
- `backend/src/db/schema.sql` — PostgreSQL DDL
- `frontend/app/page.tsx` — Main page (state management, data fetching)
- `frontend/components/FinancialPanel.tsx` — Debt table, cap table, KPIs
- `frontend/lib/types.ts` — Shared TypeScript interfaces

## Current State (MVP)
- Vision: mock only (returns Empire State + WTC every time)
- Database: in-memory mock data, no PostgreSQL connection
- Auth: JWT middleware scaffolded but not enforced on any route
- File upload: local disk (not S3/Blob)
