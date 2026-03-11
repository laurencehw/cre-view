# Contributing to CRE View

Thank you for your interest in contributing! Please read this guide before opening a PR.

## Development Setup

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env` and fill in API keys.
3. Install dependencies: `npm install` (from repo root).
4. Start the dev servers: `npm run dev`.

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/camera-integration` |
| Bug fix | `fix/<short-description>` | `fix/upload-validation` |
| Docs | `docs/<short-description>` | `docs/api-reference` |
| Chore | `chore/<short-description>` | `chore/update-dependencies` |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

Examples:
```
feat(frontend): add camera capture component
fix(backend): handle missing GPS coordinates gracefully
docs: update API reference with /financials endpoint
```

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] `npm run lint` passes (both workspaces)
- [ ] `npm run type-check` passes (both workspaces)
- [ ] `npm test` passes (both workspaces)
- [ ] New features have corresponding tests
- [ ] API changes are reflected in `docs/API.md`
- [ ] Environment variable changes are documented in `.env.example`

## Code Style

- **TypeScript** everywhere (no plain `.js` files in `src/`).
- **ESLint + Prettier** are configured — run `npm run lint` to check, `npm run format` to auto-fix.
- React components use **functional components** with hooks.
- Backend uses **async/await** instead of callbacks or raw Promises.

## Testing

| Layer | Framework |
|-------|----------|
| Frontend unit tests | Jest + React Testing Library |
| Backend unit tests | Jest + Supertest |

Run all tests:
```bash
npm test
```

## Adding a New API Endpoint

1. Create a route file under `backend/src/routes/`.
2. Register it in `backend/src/index.ts`.
3. Add validation using `express-validator`.
4. Write tests in `backend/src/routes/__tests__/`.
5. Document the endpoint in `docs/API.md`.

## Reporting Issues

Open an issue with:
- A clear title and description
- Steps to reproduce
- Expected vs. actual behaviour
- Screenshots if applicable
