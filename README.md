# CRE View

> Take a photo of a skyline and instantly see cap tables, debt, equity, and financial data for every building in view.

## Overview

CRE View is a full-stack application that uses computer vision to identify buildings from skyline photos and display commercial real estate financial data for each identified building.

## Architecture

```
cre-view/
├── frontend/          # Next.js web application
├── backend/           # Node.js/Express API server
├── docs/              # Architecture & API documentation
├── .github/           # CI/CD workflows
├── docker-compose.yml # Docker orchestration
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Docker & Docker Compose (optional)

### 1. Clone and install dependencies

```bash
git clone https://github.com/laurencehw/cre-view.git
cd cre-view

# Install all dependencies (root, frontend, backend)
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start development servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:4000
```

### 4. Using Docker

```bash
docker-compose up
```

## Key Features

- 📸 **Image Capture** — Upload or take a photo directly from your mobile camera
- 🏙️ **Skyline Analysis** — Computer vision identifies buildings in the photo
- 💰 **Financial Data** — View cap tables, debt, equity, and valuations per building
- 🗺️ **Interactive Map** — Visual overlay showing identified buildings
- 📱 **Mobile-First** — Responsive design optimized for on-the-go use

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL (schema included) |
| Computer Vision | Azure Computer Vision / Google Cloud Vision (pluggable) |
| Maps | Mapbox GL JS |
| Container | Docker, Docker Compose |

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Contributing Guide](docs/CONTRIBUTING.md)

## MVP Scope

The initial implementation includes:
1. Image upload/capture UI
2. Mock building identification (hardcoded dataset for testing)
3. Building info cards with sample financial data
4. Basic skyline map overlay
5. RESTful API ready for real computer vision integration

## Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

## License

MIT
