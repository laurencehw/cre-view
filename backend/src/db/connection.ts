// Database connection layer.
// Uses the `pg` driver when available; otherwise falls back to mock data.
//
// Install the driver when you're ready to connect to a real database:
//   npm install pg && npm install -D @types/pg
//
// Then set DATABASE_URL in your .env file.

import logger from '../services/logger';

export interface DbClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

// ─── In-memory mock client (default for MVP) ────────────────────────────────

import { MOCK_BUILDINGS, MOCK_FINANCIALS } from '../data/mockData';

class MockDbClient implements DbClient {
  async query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> {
    // Simple query pattern matching for the repository layer
    if (text.includes('FROM buildings') && text.includes('WHERE id')) {
      const id = values?.[0] as string;
      const building = MOCK_BUILDINGS.find((b) => b.id === id);
      return { rows: (building ? [building] : []) as T[] };
    }

    if (text.includes('FROM buildings')) {
      return { rows: MOCK_BUILDINGS as T[] };
    }

    if (text.includes('FROM financials') && text.includes('WHERE building_id')) {
      const buildingId = values?.[0] as string;
      const financial = MOCK_FINANCIALS.find((f) => f.buildingId === buildingId);
      return { rows: (financial ? [financial] : []) as T[] };
    }

    return { rows: [] };
  }

  async end(): Promise<void> {
    // No-op for mock
  }
}

// ─── PostgreSQL client (when pg is available) ────────────────────────────────

let pgPool: DbClient | null = null;

async function createPgClient(): Promise<DbClient> {
  try {
    // Dynamic import so the app works without pg installed.
    // Install pg + @types/pg when you're ready to connect to a real database.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = await (Function('return import("pg")')() as Promise<{ Pool: new (config: Record<string, unknown>) => { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>; end: () => Promise<void> } }>);
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Verify the connection
    await pool.query('SELECT 1');
    logger.info('Connected to PostgreSQL');

    return {
      query: <T = Record<string, unknown>>(text: string, values?: unknown[]) =>
        pool.query(text, values).then((r: { rows: unknown[] }) => ({ rows: r.rows as T[] })),
      end: () => pool.end(),
    };
  } catch (err) {
    logger.warn('PostgreSQL not available, using mock data: %s', (err as Error).message);
    return new MockDbClient();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function getDb(): Promise<DbClient> {
  if (pgPool) return pgPool;

  if (process.env.DATABASE_URL) {
    pgPool = await createPgClient();
  } else {
    pgPool = new MockDbClient();
  }

  return pgPool;
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
