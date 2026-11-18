import { denied, json } from '../../../../../server/http';
import { getViewer } from '../../../../../server/viewer';
import { weekByN, weekDenied } from '../../../../../server/content';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ n: string }> }) {
  const n = Number((await ctx.params).n);
  const week = Number.isInteger(n) ? weekByN(n) : undefined;
  if (!week) return json({ error: 'not_found' }, 404);
  const why = weekDenied(n, await getViewer(req));
  if (why) return denied(why);
  return json({ week }, 200, { 'cache-control': 'private, no-store' });
}
