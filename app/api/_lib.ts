import { Pool } from 'pg';

let pool: Pool | null = null;
export function db(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return pool;
}

/** Optional shared secret so a deployed course isn't writable by strangers. */
export function authorized(req: Request): boolean {
  const token = process.env.COURSE_ACCESS_TOKEN;
  if (!token) return true;
  return req.headers.get('authorization') === `Bearer ${token}`;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
