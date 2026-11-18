import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let pool: Pool | null = null;

export function db(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool ??= new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX) || 5,
    // Managed Postgres (Neon, Railway, Supabase, RDS) requires TLS; PGSSLMODE=disable turns it off for local dev.
    ssl: process.env.PGSSLMODE === 'disable' || /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' },
  });
  return pool;
}

export function requireDb(): Pool {
  const p = db();
  if (!p) throw new Error('DATABASE_URL is not set');
  return p;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await requireDb().connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function migrate(p: Pool = requireDb()) {
  await p.query(readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
}

/** For tests: close the shared pool. */
export async function closeDb() {
  await pool?.end();
  pool = null;
}
