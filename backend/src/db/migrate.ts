// Run schema.sql and seed.sql against the connected database.
// Called as part of the production start flow:
//   node dist/db/migrate.js && node dist/index.js

import fs from 'fs';
import path from 'path';

function findSqlFile(filename: string): string | null {
  // Try multiple paths since tsc doesn't copy .sql files to dist/
  const candidates = [
    path.join(__dirname, filename),                          // dist/db/schema.sql (if copied)
    path.join(__dirname, '..', '..', 'src', 'db', filename), // backend/src/db/schema.sql
    path.join(__dirname, '..', '..', '..', 'src', 'db', filename), // one more level up
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`Found ${filename} at ${p}`);
      return p;
    }
  }
  console.warn(`${filename} not found in any of:`, candidates);
  return null;
}

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('No DATABASE_URL — skipping migration (using mock data)');
    return;
  }

  console.log('Starting database migration...');

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Verify connection
    await pool.query('SELECT 1');
    console.log('Database connection verified');

    // Run schema
    const schemaPath = findSqlFile('schema.sql');
    if (schemaPath) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('Schema applied successfully');
    }

    // Run seed (idempotent — uses ON CONFLICT DO NOTHING)
    const seedPath = findSqlFile('seed.sql');
    if (seedPath) {
      const seed = fs.readFileSync(seedPath, 'utf-8');
      await pool.query(seed);
      console.log('Seed data applied successfully');
    }

    console.log('Migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
