// Applies db/schema.sql (idempotent). Usage: DATABASE_URL=... npm run db:migrate
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const local = /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSLMODE === 'disable';
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } });
await client.connect();
await client.query(readFileSync(join(import.meta.dirname, '..', 'db', 'schema.sql'), 'utf8'));
await client.end();
console.log('db:migrate: schema is up to date');
