# API Reference

Base URL (development): `http://localhost:4000`

All endpoints return JSON. Error responses follow the shape:
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

---

## Skyline Analysis

### `POST /api/analyze-skyline`

Upload a skyline image and receive a list of identified buildings.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | JPEG or PNG, max 10 MB |
| `latitude` | number | No | GPS latitude of the photographer |
| `longitude` | number | No | GPS longitude of the photographer |
| `heading` | number | No | Compass heading (0–360°) |

**Response `200 OK`**

```json
{
  "analysisId": "ana_01HXYZ",
  "detectedBuildings": [
    {
      "buildingId": "bld_001",
      "name": "Empire State Building",
      "confidence": 0.97,
      "boundingBox": { "x": 120, "y": 40, "width": 80, "height": 300 }
    }
  ],
  "processedAt": "2024-06-01T12:00:00Z"
}
```

**Error codes**

| Code | HTTP | Meaning |
|------|------|---------|
| `FILE_REQUIRED` | 400 | No image attached |
| `FILE_TOO_LARGE` | 400 | Image exceeds size limit |
| `INVALID_FILE_TYPE` | 400 | Not a JPEG or PNG |
| `VISION_ERROR` | 502 | Upstream vision API failed |

---

## Buildings

### `GET /api/buildings/:id`

Retrieve details for a single building.

**Path params**

| Param | Description |
|-------|-------------|
| `id` | Building identifier (e.g. `bld_001`) |

**Response `200 OK`**

```json
{
  "id": "bld_001",
  "name": "Empire State Building",
  "address": "350 Fifth Avenue, New York, NY 10118",
  "latitude": 40.748817,
  "longitude": -73.985428,
  "heightFt": 1454,
  "floors": 102,
  "completionYear": 1931,
  "primaryUse": "Mixed-Use",
  "owner": "Empire State Realty Trust"
}
```

---

### `GET /api/buildings`

List all buildings (paginated).

**Query params**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 20 | Results per page (max 100) |
| `search` | — | Filter by name or address |

**Response `200 OK`**

```json
{
  "data": [ /* building objects */ ],
  "page": 1,
  "limit": 20,
  "total": 142
}
```

---

## Financial Data

### `GET /api/buildings/:id/financials`

Get financial data for a building.

**Response `200 OK`**

```json
{
  "buildingId": "bld_001",
  "asOfDate": "2024-01-01",
  "valuation": {
    "estimatedValue": 2100000000,
    "currency": "USD",
    "capRate": 0.045,
    "noi": 94500000
  },
  "debt": {
    "totalDebt": 1200000000,
    "seniorLoan": {
      "amount": 900000000,
      "lender": "Goldman Sachs Mortgage",
      "interestRate": 0.062,
      "maturityDate": "2028-06-01"
    },
    "mezz": {
      "amount": 300000000,
      "lender": "Blackstone Credit",
      "interestRate": 0.095,
      "maturityDate": "2026-12-01"
    }
  },
  "equity": {
    "totalEquity": 900000000,
    "capTable": [
      { "investor": "Empire State Realty Trust", "ownership": 0.55, "amount": 495000000 },
      { "investor": "Sovereign Wealth Fund A", "ownership": 0.30, "amount": 270000000 },
      { "investor": "Family Office B", "ownership": 0.15, "amount": 135000000 }
    ]
  }
}
```

---

## Health Check

### `GET /api/health`

Returns API status.

**Response `200 OK`**

```json
{ "status": "ok", "uptime": 3600 }
```
