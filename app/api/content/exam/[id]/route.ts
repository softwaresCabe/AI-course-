import { denied, json } from '../../../../../server/http';
import { getViewer } from '../../../../../server/viewer';
import { examById, examDenied } from '../../../../../server/content';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const exam = examById((await ctx.params).id);
  if (!exam) return json({ error: 'not_found' }, 404);
  const why = examDenied(await getViewer(req));
  if (why) return denied(why);
  return json({ exam });
}
