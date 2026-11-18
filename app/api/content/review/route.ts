import { denied, json } from '../../../../server/http';
import { getViewer } from '../../../../server/viewer';
import { reviewPool, weekDenied } from '../../../../server/content';

export const dynamic = 'force-dynamic';

/** Spaced-review questions from earlier weeks, for a learner who can open week `n`. */
export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get('week'));
  if (!Number.isInteger(n) || n < 1 || n > 13) return json({ error: 'bad_request' }, 400);
  const v = await getViewer(req);
  const why = weekDenied(n, v);
  if (why) return denied(why);
  return json({ items: reviewPool(n, v) });
}
