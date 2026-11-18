import { authorized, db, json } from '../_lib';

export const dynamic = 'force-dynamic';

const learner = (req: Request) => (new URL(req.url).searchParams.get('learner') || 'default').slice(0, 64);

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const pool = db();
  if (!pool) return json({ error: 'DATABASE_URL not set' }, 501);
  const { rows } = await pool.query('SELECT data FROM course_progress WHERE learner_id = $1', [learner(req)]);
  return json({ data: rows[0]?.data ?? null });
}

export async function PUT(req: Request) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const pool = db();
  if (!pool) return json({ error: 'DATABASE_URL not set' }, 501);
  const body = await req.text();
  if (body.length > 2_000_000) return json({ error: 'too large' }, 413);
  const data = JSON.parse(body);
  if (data?.version !== 1) return json({ error: 'bad payload' }, 400);
  await pool.query(
    `INSERT INTO course_progress (learner_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (learner_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [learner(req), data],
  );
  return json({ ok: true });
}
