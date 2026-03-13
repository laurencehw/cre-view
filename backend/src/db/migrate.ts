// Run schema.sql and seed.sql against the connected database.
// Called as part of the production start flow:
//   node dist/db/migrate.js && node dist/index.js

import fs from 'fs';
import path from 'path';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('No DATABASE_URL — skipping migration (using mock data)');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('Schema applied');
    } else {
      // When compiled, SQL files aren't copied — look relative to src
      const srcSchemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
      if (fs.existsSync(srcSchemaPath)) {
        const schema = fs.readFileSync(srcSchemaPath, 'utf-8');
        await pool.query(schema);
        console.log('Schema applied (from src)');
      } else {
        console.warn('schema.sql not found, skipping');
      }
    }

    // Run seed (idempotent — uses ON CONFLICT DO NOTHING)
    const seedPath = path.join(__dirname, 'seed.sql');
    const srcSeedPath = path.join(__dirname, '..', '..', 'src', 'db', 'seed.sql');
    const actualSeedPath = fs.existsSync(seedPath) ? seedPath : fs.existsSync(srcSeedPath) ? srcSeedPath : null;

    if (actualSeedPath) {
      const seed = fs.readFileSync(actualSeedPath, 'utf-8');
      await pool.query(seed);
      console.log('Seed data applied');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
