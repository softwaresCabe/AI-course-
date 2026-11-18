import { config } from '../../../server/config';
import { db } from '../../../server/db';
import { json } from '../../../server/http';

export const dynamic = 'force-dynamic';

/** Liveness + configuration check for uptime monitors. Reports no secrets. */
export async function GET() {
  let database: 'ok' | 'error' | 'disabled' = 'disabled';
  const pool = db();
  if (pool) {
    try {
      await pool.query('SELECT 1 FROM entitlements LIMIT 1');
      database = 'ok';
    } catch {
      database = 'error'; // unreachable, or migrations not run
    }
  }
  const ok = database !== 'error';
  return json({ ok, database, auth: config.authEnabled, openAccess: config.openAccess, ai: config.aiEnabled, payments: config.paymentsEnabled }, ok ? 200 : 503);
}
