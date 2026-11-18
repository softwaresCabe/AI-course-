import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../../server/db';
import { json, readJson, sameOrigin } from '../../../server/http';
import { API_KEY_PREFIX, getViewer, hashKey, type Viewer } from '../../../server/viewer';

export const dynamic = 'force-dynamic';

const MAX_KEYS = 10;

async function owner(req: Request): Promise<Viewer | Response> {
  if (!db()) return json({ error: 'no_database' }, 501);
  const v = await getViewer(req); // session only — an API key can't mint more keys
  if (!v.signedIn || !v.userId || v.open) return json({ error: 'signin_required' }, 401);
  if (!v.paid) return json({ error: 'purchase_required' }, 402);
  return v;
}

export async function GET(req: Request) {
  const v = await owner(req);
  if (v instanceof Response) return v;
  const { rows } = await db()!.query(
    `SELECT id, name, prefix, created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM api_keys
     WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
    [v.userId],
  );
  return json({ keys: rows });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const v = await owner(req);
  if (v instanceof Response) return v;
  const body = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(await readJson(req, 2_000));
  if (!body.success) return json({ error: 'bad_request' }, 400);
  const { rows } = await db()!.query<{ n: string }>('SELECT count(*) AS n FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL', [v.userId]);
  if (Number(rows[0].n) >= MAX_KEYS) return json({ error: 'too_many_keys' }, 409);
  const key = API_KEY_PREFIX + randomBytes(24).toString('base64url');
  const id = randomUUID();
  await db()!.query('INSERT INTO api_keys (id, user_id, name, prefix, hash) VALUES ($1, $2, $3, $4, $5)', [id, v.userId, body.data.name, key.slice(0, 10), hashKey(key)]);
  return json({ id, key });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const v = await owner(req);
  if (v instanceof Response) return v;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  await db()!.query('UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', [id, v.userId]);
  return json({ ok: true });
}
