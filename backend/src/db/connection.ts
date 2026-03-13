// Database connection layer.
// Uses the `pg` driver when available; otherwise falls back to mock data.
//
// Install the driver when you're ready to connect to a real database:
//   npm install pg && npm install -D @types/pg
//
// Then set DATABASE_URL in your .env file.

import fs from 'fs';
import path from 'path';
import logger from '../services/logger';

export interface DbClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

// ─── In-memory mock client (default for MVP) ────────────────────────────────

import { MOCK_BUILDINGS, MOCK_FINANCIALS } from '../data/mockData';

interface MockUser {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: string;
}

// Persist mock users to a JSON file so registrations survive restarts in dev.
// In test environment, skip persistence to keep tests isolated.
const USERS_FILE = path.join(__dirname, '..', '..', '.mock-users.json');
const isTestEnv = process.env.NODE_ENV === 'test';

function loadPersistedUsers(): MockUser[] {
  if (isTestEnv) return [];
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function persistUsers(users: MockUser[]): void {
  if (isTestEnv) return;
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch {
    // Non-critical — log but don't crash
    logger.warn('Failed to persist mock users to %s', USERS_FILE);
  }
}

class MockDbClient implements DbClient {
  private users: MockUser[] = loadPersistedUsers();

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

    // User queries for auth
    if (text.includes('FROM users') && text.includes('WHERE email')) {
      const email = values?.[0] as string;
      const user = this.users.find((u) => u.email === email);
      return { rows: (user ? [user] : []) as T[] };
    }

    if (text.includes('INSERT INTO users')) {
      const [id, email, password_hash, salt, role] = values as string[];
      this.users.push({ id, email, password_hash, salt, role });
      persistUsers(this.users);
      return { rows: [] };
    }

    return { rows: [] };
  }

  async end(): Promise<void> {
    // No-op for mock
  }
}

// ─── PostgreSQL client (when pg is available) ────────────────────────────────

let pgPool: DbClient | null = null;
let pgPoolPromise: Promise<DbClient> | null = null;

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

  // Prevent race condition: if two calls arrive before the first resolves,
  // reuse the same in-flight promise instead of creating duplicate pools.
  if (pgPoolPromise) return pgPoolPromise;

  pgPoolPromise = (async () => {
    if (process.env.DATABASE_URL) {
      const client = await createPgClient();
      // On connection failure, createPgClient returns a MockDbClient.
      // Only cache the pool if it's a real connection, allowing retries on failure.
      if (!(client instanceof MockDbClient)) {
        pgPool = client;
      }
      return client;
    } else {
      // If no DATABASE_URL, we intend to use and cache the mock client.
      pgPool = new MockDbClient();
      return pgPool;
    }
  })();

  try {
    return await pgPoolPromise;
  } finally {
    pgPoolPromise = null;
  }
}

export async function closeDb(): Promise<void> {
  // If initialization is in-flight, wait for it to finish before closing
  if (pgPoolPromise) {
    await pgPoolPromise.catch(() => {});
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
