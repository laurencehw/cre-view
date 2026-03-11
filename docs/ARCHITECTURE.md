# Architecture Overview

## System Design

CRE View is a client-server application that combines computer vision, geolocation, and commercial real estate data to identify buildings in photos and surface their financial information.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client (Browser / Mobile)               │
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│   │ Image Capture │──▶│  Skyline Map │──▶│ Building Financial │  │
│   │  Component   │   │  Overlay     │   │   Detail Panel     │  │
│   └──────────────┘   └──────────────┘   └────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS REST API
┌───────────────────────────▼─────────────────────────────────────┐
│                       Backend API (Express)                       │
│                                                                  │
│   ┌────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│   │ /analyze-skyline│   │ /buildings/:id   │   │ /financials  │  │
│   │  (POST)        │   │  (GET)           │   │  (GET)       │  │
│   └───────┬────────┘   └────────┬─────────┘   └──────┬───────┘  │
│           │                     │                     │          │
│   ┌───────▼────────┐   ┌────────▼─────────────────────▼───────┐  │
│   │  Vision Service │   │          Database Layer               │  │
│   │  (Azure/GCP/AWS)│   │        (PostgreSQL)                   │  │
│   └────────────────┘   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend (Next.js 14)

| Component | Responsibility |
|-----------|---------------|
| `ImageCapture` | File upload UI; native camera access via `getUserMedia` on mobile |
| `SkylineMap` | Mapbox GL overlay rendering detected building markers |
| `BuildingCard` | Summary tile shown for each identified building |
| `FinancialPanel` | Slide-out drawer with full financial data (cap table, debt, equity) |
| `useAnalysis` hook | Manages upload → analysis → results state machine |

### Backend (Node.js / Express)

| Module | Responsibility |
|--------|---------------|
| `routes/analyze` | Accepts image upload, calls Vision Service, returns building list |
| `routes/buildings` | CRUD for building records |
| `routes/financials` | Financial data for a given building |
| `services/vision` | Pluggable adapter for Azure / GCP / AWS computer vision |
| `services/geolocation` | Maps detected landmarks to building records via coordinates |
| `db/` | PostgreSQL query helpers and schema migrations |

### Database (PostgreSQL)

Three core tables — see [`../backend/src/db/schema.sql`](../backend/src/db/schema.sql) for full DDL.

- **buildings** — master building registry
- **financials** — financial data keyed to a building
- **analyses** — image analysis results (which buildings were detected)

## Data Flow

1. User captures / uploads a skyline photo in the browser.
2. Frontend `POST /api/analyze-skyline` with multipart form data (image + optional GPS coordinates).
3. Backend receives image, forwards to Computer Vision API to extract landmark/POI labels.
4. Backend cross-references labels + GPS bounding box against the `buildings` table.
5. API returns an array of matched building IDs with confidence scores.
6. Frontend renders building markers on the Mapbox skyline overlay.
7. User taps a building → `GET /api/buildings/:id/financials` fetches full financial data.
8. Financial panel renders cap table, debt tranches, equity splits, and valuation metrics.

## Scalability Considerations

- **Image processing** can be moved to an async job queue (Bull/BullMQ + Redis) for large images.
- **Building database** can be replaced with a live CRE data feed (CoStar, REIS) via a polling or webhook integration.
- **Caching** — frequently-requested building financials should be cached (Redis) to avoid redundant DB hits.
- **CDN** — uploaded images should be stored in object storage (S3 / Azure Blob) rather than the local filesystem in production.

## Security

- All endpoints validate and sanitize input with `express-validator`.
- Image uploads are size-limited (`MAX_FILE_SIZE_MB`) and mime-type checked.
- API keys are stored in environment variables, never in source code.
- CORS is restricted to `CORS_ORIGIN`.
- JWT authentication is scaffolded for future user accounts.
