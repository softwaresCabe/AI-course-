// The checkout request we send to Stripe, with the Stripe client stubbed (no network).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, hasDb, resetDb, useProdEnv } from './helpers';

const created = vi.hoisted(() => ({ params: [] as Record<string, unknown>[] }));
vi.mock('stripe', async (orig) => {
  const actual = (await orig()) as { default: new (...a: unknown[]) => object };
  class FakeStripe extends actual.default {
    checkout = {
      sessions: {
        create: async (p: Record<string, unknown>) => {
          created.params.push(p);
          return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
        },
      },
    };
  }
  return { ...actual, default: FakeStripe };
});

import { CheckoutError, createCheckout, fulfillSession } from '../server/billing';
import { viewerForUser } from '../server/viewer';
import type Stripe from 'stripe';

describe.skipIf(!hasDb)('createCheckout', () => {
  beforeAll(() => useProdEnv());
  beforeEach(async () => {
    await resetDb();
    created.params = [];
  });
  afterAll(closeDb);

  it('sends a one-time payment with the price, metadata snapshot and return URLs', async () => {
    const v = await viewerForUser('user_buyer', 'session');
    const url = await createCheckout(v, 'course');
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const p = created.params[0] as Stripe.Checkout.SessionCreateParams;
    expect(p.mode).toBe('payment');
    expect(p.client_reference_id).toBe('user_buyer');
    expect(p.metadata).toEqual({ userId: 'user_buyer', product: 'course', tokens: '1000000' });
    expect(p.payment_intent_data?.metadata).toEqual(p.metadata);
    expect(p.line_items?.[0].price_data).toMatchObject({ currency: 'usd', unit_amount: 19900 });
    expect(p.success_url).toBe('http://localhost:3000/?checkout=success&session_id={CHECKOUT_SESSION_ID}#account');
    expect(p.cancel_url).toBe('http://localhost:3000/?checkout=cancel#account');
  });

  it('prices token packs from config', async () => {
    process.env.TOKENS_3M_PRICE_CENTS = '2900';
    await createCheckout(await viewerForUser('user_buyer', 'session'), 'tokens_3m');
    expect((created.params[0] as Stripe.Checkout.SessionCreateParams).line_items?.[0].price_data?.unit_amount).toBe(2900);
    delete process.env.TOKENS_3M_PRICE_CENTS;
  });

  it('refuses anonymous buyers, unknown products and buying the course twice', async () => {
    const anon = { userId: null, signedIn: false, paid: false, admin: false, open: false, via: 'anonymous' as const };
    await expect(createCheckout(anon, 'course')).rejects.toMatchObject({ status: 401 });
    const v = await viewerForUser('user_buyer', 'session');
    await expect(createCheckout(v, 'free_stuff')).rejects.toBeInstanceOf(CheckoutError);
    await fulfillSession({ id: 'cs_x', payment_status: 'paid', metadata: { userId: 'user_buyer', product: 'course', tokens: '0' }, amount_total: 1, currency: 'usd' } as unknown as Stripe.Checkout.Session);
    const owner = await viewerForUser('user_buyer', 'session');
    await expect(createCheckout(owner, 'course')).rejects.toMatchObject({ status: 409 });
    await expect(createCheckout(owner, 'tokens_1m')).resolves.toMatch(/^https:/); // packs are still purchasable
    expect(created.params).toHaveLength(1);
  });
});
