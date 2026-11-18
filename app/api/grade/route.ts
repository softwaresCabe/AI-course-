import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../../../server/config';
import { json, rateLimit, readJson, sameOrigin } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { canGrade } from '../../../server/content';
import { gradeShortAnswer } from '../../../server/grader';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Body = z.object({ questionId: z.string().min(1).max(40), answer: z.string().min(1).max(8000) });

/** Rubric-grade one written answer. Included with course access (not metered), but rate limited. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (!config.aiEnabled) return json({ error: 'ai_unavailable' }, 501);
  const v = await getViewer(req);
  if (!v.signedIn) return json({ error: 'signin_required' }, 401);
  const body = Body.safeParse(await readJson(req, 40_000));
  if (!body.success) return json({ error: 'bad_request' }, 400);
  const q = canGrade(body.data.questionId, v);
  if (!q) return json({ error: 'not_found' }, 404);
  if (!v.open && !(await rateLimit(`grade:${v.userId}`, config.gradesPerDay, 86_400))) return json({ error: 'rate_limited' }, 429);
  try {
    const out = await gradeShortAnswer(q, body.data.answer);
    return out ? json(out) : json({ error: 'ungradable' }, 502);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    console.error('grade error', e);
    return json({ error: 'upstream_error' }, 502);
  }
}
