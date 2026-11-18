import { db } from './db';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export const denied = (reason: 'signin_required' | 'purchase_required') =>
  json({ error: reason }, reason === 'signin_required' ? 401 : 402);

/** Parse a JSON body with a size cap; returns null on bad/oversized input. */
export async function readJson<T>(req: Request, maxBytes = 64_000): Promise<T | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances).
 * Returns true if the call is allowed. Without a database, everything is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const pool = db();
  if (!pool || limit <= 0) return true;
  const { rows } = await pool.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowSec],
  );
  // Opportunistic cleanup of old windows (cheap, indexed by PK prefix scan is not needed at this size).
  if (Math.random() < 0.01) void pool.query("DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'").catch(() => {});
  return rows[0].count <= limit;
}

/** Same-origin check for state-changing browser requests (defence in depth on top of SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients (curl, server-to-server) don't send Origin
  try {
    const host = new URL(origin).host;
    const served = [req.headers.get('x-forwarded-host'), req.headers.get('host'), new URL(req.url).host];
    return served.includes(host) || origin === (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  } catch {
    return false;
  }
}
