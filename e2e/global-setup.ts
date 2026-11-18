// Fresh, migrated database for each E2E run.
import pg from 'pg';
import { readFileSync } from 'node:fs';

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error('Set E2E_DATABASE_URL to a disposable Postgres database for the E2E run');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(readFileSync('db/schema.sql', 'utf8'));
  await c.query('TRUNCATE course_progress');
  await c.end();
}
