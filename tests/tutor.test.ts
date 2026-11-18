// The tutor agent loop with a scripted fake model: tool use, streaming, metering and failure paths.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, hasDb, resetDb, useProdEnv } from './helpers';

type Scripted = { text?: string; tool?: { name: string; input: unknown }; usage?: { input_tokens: number; output_tokens: number }; stop?: string; throws?: Error };
const script = vi.hoisted(() => ({ turns: [] as Scripted[], requests: [] as Record<string, unknown>[] }));

vi.mock('@anthropic-ai/sdk', async (orig) => {
  const actual = (await orig()) as { default: Record<string, unknown> };
  class FakeAnthropic {
    beta = {
      messages: {
        stream(params: Record<string, unknown>) {
          script.requests.push(structuredClone(params));
          const turn = script.turns.shift() ?? { text: '(no more scripted turns)' };
          const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
          return {
            on(ev: string, cb: (...a: unknown[]) => void) {
              (handlers[ev] ??= []).push(cb);
              return this;
            },
            async finalMessage() {
              if (turn.throws) throw turn.throws;
              const usage = { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...turn.usage };
              if (turn.text) for (const cb of handlers.text ?? []) cb(turn.text, turn.text);
              const content: unknown[] = [];
              if (turn.text) content.push({ type: 'text', text: turn.text });
              if (turn.tool) content.push({ type: 'tool_use', id: 'tu_' + Math.random().toString(36).slice(2), name: turn.tool.name, input: turn.tool.input });
              for (const cb of handlers.streamEvent ?? []) cb({}, { usage });
              return { content, usage, stop_reason: turn.stop ?? (turn.tool ? 'tool_use' : 'end_turn') };
            },
          };
        },
      },
    };
  }
  for (const k of ['APIError', 'RateLimitError', 'AuthenticationError', 'BadRequestError']) (FakeAnthropic as unknown as Record<string, unknown>)[k] = (actual.default as Record<string, unknown>)[k];
  return { ...actual, default: FakeAnthropic };
});

import { runTutor } from '../server/tutor';
import { viewerForUser } from '../server/viewer';
import { balance, credit } from '../server/ledger';
import { requireDb } from '../server/db';
import Anthropic from '@anthropic-ai/sdk';
import type { TutorEvent } from '../src/lib/platform';

async function run(userId: string, msg = 'help me with backprop', week = 1) {
  const events: TutorEvent[] = [];
  const viewer = await viewerForUser(userId, 'session');
  await runTutor({ viewer, week, messages: [{ role: 'user', content: msg }], emit: (e) => events.push(e) });
  return { events, text: events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('') };
}

describe.skipIf(!hasDb)('AI tutor agent', () => {
  beforeAll(() => useProdEnv());
  beforeEach(async () => {
    await resetDb();
    script.turns = [];
    script.requests = [];
  });
  afterAll(closeDb);

  it('uses course tools, streams the answer, and charges actual usage', async () => {
    script.turns = [
      { tool: { name: 'search_course', input: { query: 'chain rule gradient' } } },
      { tool: { name: 'read_section', input: { week: 1, section: 3 } } },
      { text: 'The chain rule multiplies local derivatives. See Week 1 §1.4.', usage: { input_tokens: 4000, output_tokens: 200 } },
    ];
    const { events, text } = await run('user_a');
    expect(text).toContain('chain rule');
    expect(events.filter((e) => e.type === 'tool').map((e) => (e as { name: string }).name)).toEqual(['search_course', 'read_section']);
    // charged = inputs (1000 + 1000 + 4000) + 5 × outputs (100 + 100 + 200)
    const usage = events.find((e) => e.type === 'usage') as { charged: number; balance: number };
    expect(usage.charged).toBe(6000 + 5 * 400);
    expect(usage.balance).toBe(50_000 - 8000);
    expect(await balance('user_a')).toBe(42_000);
    // tool results were fed back: the third request has the read_section result in it
    const third = JSON.stringify(script.requests[2].messages);
    expect(third).toContain('Week 1 · 1.4');
  });

  it('keeps the prompt cacheable and opts into refusal fallbacks', async () => {
    script.turns = [{ text: 'hi' }];
    await run('user_a');
    const r = script.requests[0] as { system: { cache_control?: unknown }[]; model: string; fallbacks?: string; tools: unknown[] };
    expect(r.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(r.model).toBe('claude-opus-5-5');
    expect(r.fallbacks).toBe('default');
    expect(r.tools).toHaveLength(7);
  });

  it('refuses when the balance is too low, without calling the model', async () => {
    await viewerForUser('user_b', 'session'); // create + grant
    await credit('user_b', -49_000, 'admin', 'drain');
    const { events } = await run('user_b');
    expect(events).toEqual([{ type: 'error', code: 'insufficient_tokens', message: expect.any(String) }]);
    expect(script.requests).toHaveLength(0);
    expect(await balance('user_b')).toBe(1_000);
  });

  it("a free user's tutor cannot read paid weeks through tools", async () => {
    script.turns = [{ tool: { name: 'read_section', input: { week: 9, section: 0 } } }, { text: 'That is covered in Week 9 of the full course.' }];
    await run('user_free');
    const second = JSON.stringify(script.requests[1].messages);
    expect(second).toContain('"locked\\":true');
    expect(second).not.toContain('# Week 9');
  });

  it('rejects malformed tool input without running the tool', async () => {
    script.turns = [{ tool: { name: 'read_section', input: { week: 'nine' } } }, { text: 'ok' }];
    const { events } = await run('user_a');
    expect(events.some((e) => e.type === 'tool')).toBe(false);
    expect(JSON.stringify(script.requests[1].messages)).toContain('Invalid input');
  });

  it('stops after the iteration cap', async () => {
    script.turns = [...Array(10)].map(() => ({ tool: { name: 'list_weeks', input: {} } }));
    await run('user_a');
    expect(script.requests).toHaveLength(6);
  });

  it('upstream errors are reported and the hold is fully settled', async () => {
    script.turns = [{ throws: new Anthropic.APIError(500, { type: 'error' }, 'boom', new Headers()) }];
    const { events } = await run('user_a');
    expect(events.some((e) => e.type === 'error' && e.code === 'upstream_error')).toBe(true);
    // Nothing streamed, so only the usage seen so far is charged (zero here) and the hold is released.
    expect(await balance('user_a')).toBe(50_000);
    const { rows } = await requireDb().query("SELECT reason, delta FROM token_ledger WHERE user_id = 'user_a' ORDER BY id");
    expect(rows.map((r) => r.reason)).toEqual(['signup_grant', 'hold', 'release', 'usage']);
  });

  it('admins are not metered', async () => {
    process.env.ADMIN_USER_IDS = 'user_admin';
    script.turns = [{ text: 'hello' }];
    const { events } = await run('user_admin');
    expect(events.find((e) => e.type === 'usage')).toMatchObject({ balance: null });
    delete process.env.ADMIN_USER_IDS;
  });
});
