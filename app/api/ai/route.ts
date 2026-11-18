import Anthropic from '@anthropic-ai/sdk';
import { authorized, json } from '../_lib';

export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * AI TA + rubric grading for the Next.js deployment.
 * POST { mode: 'text' | 'json', messages } → streamed text, or { value } for json mode.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not set' }, 501);
  const { mode, messages } = (await req.json()) as { mode: 'text' | 'json'; messages: Msg[] };
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) return json({ error: 'bad request' }, 400);

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

  if (mode === 'json') {
    const res = await client.messages.create({ model, max_tokens: 1024, messages });
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const match = text.match(/\{[\s\S]*\}/);
    try {
      return json({ value: JSON.parse(match ? match[0] : text) });
    } catch {
      return json({ error: 'model did not return JSON' }, 502);
    }
  }

  const stream = client.messages.stream({ model, max_tokens: 1500, messages });
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const ev of stream) {
            if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') controller.enqueue(encoder.encode(ev.delta.text));
          }
        } catch (e) {
          controller.error(e);
          return;
        }
        controller.close();
      },
      cancel() {
        stream.abort();
      },
    }),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
  );
}
