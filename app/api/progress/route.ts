import { db } from '../../../server/db';
import { json, readJson, sameOrigin } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { loadProgress, saveProgress, validProgress } from '../../../server/progress';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v.signedIn || !v.userId) return json({ error: 'signin_required' }, 401);
  if (!db()) return json({ error: 'no_database' }, 501);
  return json({ data: await loadProgress(v.userId) });
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const v = await getViewer(req);
  if (!v.signedIn || !v.userId) return json({ error: 'signin_required' }, 401);
  if (!db()) return json({ error: 'no_database' }, 501);
  const data = await readJson<unknown>(req, 1_000_000);
  if (!validProgress(data)) return json({ error: 'bad_payload' }, 400);
  await saveProgress(v.userId, data);
  return json({ ok: true });
}
