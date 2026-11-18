import { z } from 'zod';
import { config } from '../../../server/config';
import { denied, json, rateLimit, readJson, sameOrigin } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { weekDenied } from '../../../server/content';
import { MessagesSchema, runTutor } from '../../../server/tutor';
import type { TutorEvent } from '../../../src/lib/platform';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ week: z.number().int().min(1).max(13), messages: MessagesSchema });

/** AI tutor turn. Streams NDJSON TutorEvents. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (!config.aiEnabled) return json({ error: 'ai_unavailable', message: 'The AI tutor is not enabled on this deployment.' }, 501);
  const v = await getViewer(req);
  if (!v.signedIn) return json({ error: 'signin_required', message: 'Sign in to use the tutor.' }, 401);
  const body = Body.safeParse(await readJson(req, 200_000));
  if (!body.success) return json({ error: 'bad_request', message: 'Invalid request.' }, 400);
  const why = weekDenied(body.data.week, v);
  if (why) return denied(why);
  if (!v.open && !(await rateLimit(`tutor:${v.userId}`, config.tutorRequestsPerHour, 3600)))
    return json({ error: 'rate_limited', message: 'You’ve asked a lot of questions this hour — take a breather and try again shortly.' }, 429);

  const enc = new TextEncoder();
  const abort = new AbortController();
  req.signal?.addEventListener('abort', () => abort.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: TutorEvent) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + '\n'));
        } catch {
          open = false;
        }
      };
      try {
        await runTutor({ viewer: v, week: body.data.week, messages: body.data.messages, emit, signal: abort.signal });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
