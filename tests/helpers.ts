// Shared setup for DB-backed tests. Point TEST_DATABASE_URL at a disposable database, e.g.
//   TEST_DATABASE_URL=postgres://course:course@localhost:5432/course_test npm test
import { closeDb, migrate, requireDb } from '../server/db';

export const TEST_DB = process.env.TEST_DATABASE_URL;
export const hasDb = !!TEST_DB;

/** Configure the server as a production-like deployment: Clerk auth on, open access off. */
export function useProdEnv(extra: Record<string, string> = {}) {
  const vars: Record<string, string> = {
    DATABASE_URL: TEST_DB ?? '',
    OPEN_ACCESS: 'false',
    CLERK_SECRET_KEY: 'sk_test_dummy',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dummy',
    ANTHROPIC_API_KEY: 'test-key',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    FREE_TUTOR_TOKENS: '50000',
    ADMIN_EMAILS: 'owner@example.com',
    ...extra,
  };
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

export async function resetDb() {
  const pool = requireDb();
  await migrate(pool);
  await pool.query(
    'TRUNCATE users, course_progress, entitlements, purchases, token_balances, token_ledger, api_keys, stripe_events, rate_limits CASCADE',
  );
}

export { closeDb };

export const req = (path: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...rest } = init;
  return new Request(`http://localhost:3000${path}`, {
    ...rest,
    ...(json !== undefined ? { method: rest.method ?? 'POST', body: JSON.stringify(json), headers: { 'content-type': 'application/json', ...(rest.headers ?? {}) } } : {}),
  });
};

export async function body<T = Record<string, unknown>>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
