// End-to-end tests of the API route handlers against a real Postgres, with Clerk replaced by a stub.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { body, closeDb, hasDb, params, req, resetDb, useProdEnv } from './helpers';

const clerk = vi.hoisted(() => ({ userId: null as string | null, emails: {} as Record<string, string> }));
vi.mock('../server/clerk', () => ({
  sessionUserId: async () => clerk.userId,
  primaryEmail: async (id: string) => clerk.emails[id] ?? null,
}));

import * as me from '../app/api/me/route';
import * as week from '../app/api/content/week/[n]/route';
import * as exam from '../app/api/content/exam/[id]/route';
import * as review from '../app/api/content/review/route';
import * as progress from '../app/api/progress/route';
import * as keys from '../app/api/keys/route';
import * as mcp from '../app/api/mcp/route';
import * as webhook from '../app/api/stripe/webhook/route';
import * as grade from '../app/api/grade/route';
import * as tutor from '../app/api/tutor/route';
import * as health from '../app/api/health/route';
import { fulfillSession } from '../server/billing';
import { balance } from '../server/ledger';
import { requireDb } from '../server/db';
import type { Me } from '../src/lib/platform';

const as = (id: string | null) => (clerk.userId = id);

async function buyCourse(userId: string, sessionId = 'cs_test_' + userId) {
  return fulfillSession({
    id: sessionId,
    payment_status: 'paid',
    metadata: { userId, product: 'course', tokens: '1000000' },
    client_reference_id: userId,
    amount_total: 19900,
    currency: 'usd',
    payment_intent: 'pi_' + userId,
    customer_details: { email: `${userId}@example.com` },
  } as unknown as Stripe.Checkout.Session);
}

async function signedEvent(event: object) {
  const payload = JSON.stringify(event);
  const sig = await new Stripe('sk_test_dummy').webhooks.generateTestHeaderStringAsync({ payload, secret: 'whsec_test_secret' });
  return req('/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': sig } });
}

describe.skipIf(!hasDb)('API', () => {
  beforeAll(() => useProdEnv());
  beforeEach(async () => {
    await resetDb();
    as(null);
  });
  afterAll(closeDb);

  describe('health', () => {
    it('reports a migrated database', async () => {
      const r = await health.GET();
      expect(r.status).toBe(200);
      expect(await body(r)).toMatchObject({ ok: true, database: 'ok', auth: true, openAccess: false });
    });
  });

  describe('/api/me', () => {
    it('anonymous visitor: not signed in, sees products', async () => {
      const m = await body<Me>(await me.GET(req('/api/me')));
      expect(m).toMatchObject({ mode: 'auth', signedIn: false, paid: false, tokens: null });
      expect(m.products.map((p) => p.id)).toContain('course');
    });
    it('first sign-in creates the user and grants starter tokens exactly once', async () => {
      as('user_a');
      const m1 = await body<Me>(await me.GET(req('/api/me')));
      expect(m1).toMatchObject({ signedIn: true, paid: false, tokens: { balance: 50_000 } });
      const m2 = await body<Me>(await me.GET(req('/api/me')));
      expect(m2.tokens?.balance).toBe(50_000);
    });
    it('admin by verified email gets full, unmetered access', async () => {
      as('user_owner');
      clerk.emails.user_owner = 'owner@example.com';
      const m = await body<Me>(await me.GET(req('/api/me')));
      expect(m).toMatchObject({ signedIn: true, paid: true, admin: true, tokens: null });
    });
  });

  describe('content gating', () => {
    const getWeek = (n: number) => week.GET(req(`/api/content/week/${n}`), params({ n: String(n) }));

    it('week 1 is public', async () => {
      const r = await getWeek(1);
      expect(r.status).toBe(200);
      expect((await body<{ week: { n: number; sections: unknown[] } }>(r)).week.sections.length).toBeGreaterThan(0);
    });
    it('week 2 needs an account (401), then opens', async () => {
      expect(await body(await getWeek(2))).toEqual({ error: 'signin_required' });
      expect((await getWeek(2)).status).toBe(401);
      as('user_a');
      expect((await getWeek(2)).status).toBe(200);
    });
    it('weeks 3–13 and exams need the course (402), then open after purchase', async () => {
      as('user_a');
      for (const n of [3, 7, 13]) expect((await getWeek(n)).status).toBe(402);
      expect((await exam.GET(req('/api/content/exam/midterm'), params({ id: 'midterm' }))).status).toBe(402);
      expect(await buyCourse('user_a')).toBe('fulfilled');
      for (const n of [3, 7, 13]) expect((await getWeek(n)).status).toBe(200);
      const e = await exam.GET(req('/api/content/exam/final'), params({ id: 'final' }));
      expect(e.status).toBe(200);
    });
    it('unknown weeks/exams are 404', async () => {
      expect((await getWeek(14)).status).toBe(404);
      expect((await week.GET(req('/api/content/week/x'), params({ n: 'x' }))).status).toBe(404);
      expect((await exam.GET(req('/api/content/exam/quiz'), params({ id: 'quiz' }))).status).toBe(404);
    });
    it('spaced review only includes weeks the learner can open', async () => {
      as('user_a');
      const r = await review.GET(req('/api/content/review?week=2'));
      const items = (await body<{ items: { week: number }[] }>(r)).items;
      expect(items.length).toBeGreaterThan(0);
      expect(new Set(items.map((i) => i.week))).toEqual(new Set([1]));
      expect((await review.GET(req('/api/content/review?week=5'))).status).toBe(402);
    });
  });

  describe('progress', () => {
    const doc = { version: 1, read: { 'w1-s0': true }, checklist: {}, quizzes: {}, exams: {}, examStarted: {}, labs: {}, review: {}, updatedAt: '2026-11-18T00:00:00.000Z' };
    it('requires sign-in', async () => {
      expect((await progress.GET(req('/api/progress'))).status).toBe(401);
    });
    it('is scoped per user', async () => {
      as('user_a');
      expect((await progress.PUT(req('/api/progress', { method: 'PUT', json: doc }))).status).toBe(200);
      expect((await body(await progress.GET(req('/api/progress')))).data).toMatchObject({ read: { 'w1-s0': true } });
      as('user_b');
      expect((await body(await progress.GET(req('/api/progress')))).data).toBeNull();
    });
    it('rejects malformed payloads and cross-origin writes', async () => {
      as('user_a');
      expect((await progress.PUT(req('/api/progress', { method: 'PUT', json: { version: 2 } }))).status).toBe(400);
      expect((await progress.PUT(req('/api/progress', { method: 'PUT', json: { ...doc, read: [] } }))).status).toBe(400);
      expect((await progress.PUT(req('/api/progress', { method: 'PUT', json: doc, headers: { origin: 'https://evil.example' } }))).status).toBe(403);
    });
  });

  describe('Stripe webhook', () => {
    const completed = (userId: string, product: string, tokens: string, id = 'cs_wh_1') => ({
      id: 'evt_' + id,
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id, object: 'checkout.session', payment_status: 'paid', metadata: { userId, product, tokens }, client_reference_id: userId, amount_total: 1000, currency: 'usd', payment_intent: 'pi_' + id } },
    });

    it('rejects unsigned / badly signed events', async () => {
      expect((await webhook.POST(req('/api/stripe/webhook', { method: 'POST', body: '{}' }))).status).toBe(400);
      expect((await webhook.POST(req('/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=bad' } }))).status).toBe(400);
    });
    it('fulfils a token pack once, even if delivered twice', async () => {
      for (let i = 0; i < 2; i++) expect((await webhook.POST(await signedEvent(completed('user_t', 'tokens_1m', '1000000')))).status).toBe(200);
      expect(await balance('user_t')).toBe(1_000_000 + 50_000); // pack + signup grant
      const { rows } = await requireDb().query('SELECT count(*)::int AS n FROM purchases');
      expect(rows[0].n).toBe(1);
    });
    it('a course purchase unlocks content and bundles tokens; a refund revokes both', async () => {
      await webhook.POST(await signedEvent(completed('user_c', 'course', '1000000', 'cs_course')));
      as('user_c');
      expect((await week.GET(req('/api/content/week/9'), params({ n: '9' }))).status).toBe(200);
      const before = await balance('user_c');
      expect(before).toBe(1_000_000 + 50_000); // bundle + signup grant (granted on first /me)
      const refund = { id: 'evt_refund', object: 'event', type: 'charge.refunded', data: { object: { id: 'ch_1', object: 'charge', refunded: true, payment_intent: 'pi_cs_course' } } };
      expect((await webhook.POST(await signedEvent(refund))).status).toBe(200);
      expect((await webhook.POST(await signedEvent(refund))).status).toBe(200); // idempotent
      expect((await week.GET(req('/api/content/week/9'), params({ n: '9' }))).status).toBe(402);
      expect(await balance('user_c')).toBe(50_000);
    });
    it('ignores unpaid sessions', async () => {
      const ev = completed('user_u', 'course', '1000000', 'cs_unpaid');
      (ev.data.object as { payment_status: string }).payment_status = 'unpaid';
      await webhook.POST(await signedEvent(ev));
      const { rows } = await requireDb().query('SELECT count(*)::int AS n FROM entitlements');
      expect(rows[0].n).toBe(0);
    });
  });

  describe('MCP API keys and server', () => {
    const rpc = (key: string | null, method: string, p: unknown = {}, id = 1) =>
      mcp.POST(
        req('/api/mcp', {
          method: 'POST',
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params: p }),
          headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        }),
      );
    const init = (key: string) => rpc(key, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });

    async function newKey(userId: string) {
      as(userId);
      const r = await keys.POST(req('/api/keys', { json: { name: 'laptop' } }));
      expect(r.status).toBe(200);
      return (await body<{ key: string }>(r)).key;
    }

    it('keys require a purchased course', async () => {
      as('user_free');
      expect((await keys.POST(req('/api/keys', { json: { name: 'x' } }))).status).toBe(402);
    });
    it('rejects missing/invalid keys', async () => {
      expect((await init('nope')).status).toBe(401);
      expect((await rpc(null, 'tools/list')).status).toBe(401);
    });
    it('lists, calls and gates tools for the key owner; revocation takes effect', async () => {
      await buyCourse('user_k');
      const key = await newKey('user_k');
      as(null); // MCP calls carry only the key
      const i = await init(key);
      expect(i.status).toBe(200);
      expect((await body<{ result: { serverInfo: { name: string } } }>(i)).result.serverInfo.name).toBe('aie600-course');

      const list = await body<{ result: { tools: { name: string }[] } }>(await rpc(key, 'tools/list'));
      expect(list.result.tools.map((t) => t.name).sort()).toEqual(['get_lab', 'get_missed_questions', 'get_my_progress', 'get_week_materials', 'list_weeks', 'read_section', 'search_course']);

      const call = await body<{ result: { content: { text: string }[] } }>(await rpc(key, 'tools/call', { name: 'read_section', arguments: { week: 8, section: 0 } }));
      expect(call.result.content[0].text).toMatch(/^# Week 8 · 8\.1/);

      const search = await body<{ result: { content: { text: string }[] } }>(await rpc(key, 'tools/call', { name: 'search_course', arguments: { query: 'KV cache memory' } }));
      expect(JSON.parse(search.result.content[0].text).results[0].week).toBe(8);

      // listing and revoking via the session
      as('user_k');
      const listed = await body<{ keys: { id: string; prefix: string }[] }>(await keys.GET(req('/api/keys')));
      expect(listed.keys).toHaveLength(1);
      expect(key.startsWith(listed.keys[0].prefix)).toBe(true);
      await keys.DELETE(req(`/api/keys?id=${listed.keys[0].id}`, { method: 'DELETE' }));
      expect((await init(key)).status).toBe(401);
    });
    it('a key never grants more than its owner has', async () => {
      // Make a key for a buyer, then refund them: the key should now see locked weeks.
      await buyCourse('user_r', 'cs_r');
      const key = await newKey('user_r');
      await requireDb().query("UPDATE entitlements SET revoked_at = now() WHERE user_id = 'user_r'");
      as(null);
      const call = await body<{ result: { content: { text: string }[] } }>(await rpc(key, 'tools/call', { name: 'read_section', arguments: { week: 8, section: 0 } }));
      expect(JSON.parse(call.result.content[0].text)).toMatchObject({ locked: true, week: 8 });
    });
  });

  describe('AI endpoints (no model call needed)', () => {
    it('grade: requires sign-in and access to the question', async () => {
      expect((await grade.POST(req('/api/grade', { json: { questionId: 'm20', answer: 'x' } }))).status).toBe(401);
      as('user_a');
      const { finalExam, weeks } = await import('../src/content/course');
      const examShort = finalExam.questions.find((q) => q.type === 'short')!;
      expect((await grade.POST(req('/api/grade', { json: { questionId: examShort.id, answer: 'x' } }))).status).toBe(404);
      const mcqId = weeks[0].quiz.find((q) => q.type === 'mcq')!.id;
      expect((await grade.POST(req('/api/grade', { json: { questionId: mcqId, answer: 'x' } }))).status).toBe(404); // not a written question
    });
    it('tutor: validates input and enforces week access', async () => {
      expect((await tutor.POST(req('/api/tutor', { json: { week: 1, messages: [{ role: 'user', content: 'hi' }] } }))).status).toBe(401);
      as('user_a');
      expect((await tutor.POST(req('/api/tutor', { json: { week: 1, messages: [] } }))).status).toBe(400);
      expect((await tutor.POST(req('/api/tutor', { json: { week: 1, messages: [{ role: 'assistant', content: 'x' }] } }))).status).toBe(400);
      expect((await tutor.POST(req('/api/tutor', { json: { week: 5, messages: [{ role: 'user', content: 'hi' }] } }))).status).toBe(402);
    });
  });
});
