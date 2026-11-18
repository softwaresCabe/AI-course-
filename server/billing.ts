// Stripe Checkout (one-time payments) for the course and tutor token packs.
// Fulfilment is idempotent on the checkout session id, so the webhook and the success-page confirm
// can both call fulfillSession() safely, in any order, any number of times.
import Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { config } from './config';
import { requireDb, tx } from './db';
import { credit } from './ledger';
import { productById } from './products';
import type { Viewer } from './viewer';

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  client ??= new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: 'aie600-course' } });
  return client;
}

export class CheckoutError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function createCheckout(viewer: Viewer, productId: string): Promise<string> {
  if (!viewer.userId || !viewer.signedIn || viewer.open) throw new CheckoutError(401, 'signin_required');
  const product = productById(productId);
  if (!product) throw new CheckoutError(400, 'unknown_product');
  if (product.kind === 'course' && viewer.paid) throw new CheckoutError(409, 'already_owned');

  const { rows } = await requireDb().query<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [viewer.userId]);
  // Snapshot what was sold into metadata, so later price/bundle changes never alter a past purchase.
  const metadata = { userId: viewer.userId, product: product.id, tokens: String(product.tokens) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    client_reference_id: viewer.userId,
    customer_email: rows[0]?.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: product.priceCents,
          product_data: { name: `AIE 600 — ${product.name}`, description: product.blurb },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    allow_promotion_codes: true,
    success_url: `${config.siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#account`,
    cancel_url: `${config.siteUrl}/?checkout=cancel#account`,
  });
  if (!session.url) throw new CheckoutError(502, 'no_checkout_url');
  return session.url;
}

export type FulfillResult = 'fulfilled' | 'duplicate' | 'unpaid' | 'invalid';

/** Grant whatever a paid checkout session bought. Safe to call repeatedly. */
export async function fulfillSession(session: Stripe.Checkout.Session): Promise<FulfillResult> {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return 'unpaid';
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const product = session.metadata?.product ? productById(session.metadata.product) : undefined;
  const tokens = Number(session.metadata?.tokens ?? product?.tokens ?? 0);
  if (!userId || !product || !Number.isFinite(tokens)) return 'invalid';
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

  return tx(async (c) => {
    const newUser = await c.query('INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id', [userId, session.customer_details?.email?.toLowerCase() ?? null]);
    if (newUser.rowCount && config.signupTokens > 0) await credit(userId, config.signupTokens, 'signup_grant', userId, c);
    const ins = await c.query(
      `INSERT INTO purchases (user_id, product, stripe_session_id, payment_intent, amount_cents, currency, tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
      [userId, product.id, session.id, paymentIntent, session.amount_total ?? 0, session.currency ?? config.currency, tokens],
    );
    if (!ins.rowCount) return 'duplicate';
    if (product.kind === 'course') {
      await c.query(
        `INSERT INTO entitlements (user_id, source) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET source = EXCLUDED.source, granted_at = now(), revoked_at = NULL`,
        [userId, `stripe:${session.id}`],
      );
      if (tokens > 0) await credit(userId, tokens, 'course_bundle', session.id, c);
    } else if (tokens > 0) {
      await credit(userId, tokens, 'purchase', session.id, c);
    }
    return 'fulfilled';
  });
}

/** Full refund or dispute: revoke what the purchase granted (once). Partial refunds are left to the operator. */
export async function reversePayment(paymentIntent: string, why: 'refund' | 'dispute') {
  await tx(async (c: PoolClient) => {
    const { rows } = await c.query<{ id: string; user_id: string; product: string; stripe_session_id: string; tokens: string }>(
      'SELECT id, user_id, product, stripe_session_id, tokens FROM purchases WHERE payment_intent = $1 AND refunded_at IS NULL FOR UPDATE',
      [paymentIntent],
    );
    for (const p of rows) {
      await c.query('UPDATE purchases SET refunded_at = now() WHERE id = $1', [p.id]);
      if (p.product === 'course') {
        await c.query("UPDATE entitlements SET revoked_at = now() WHERE user_id = $1 AND source = $2", [p.user_id, `stripe:${p.stripe_session_id}`]);
      }
      // Take back the tokens this purchase added (the balance may go negative if they were already spent).
      if (Number(p.tokens) > 0) await credit(p.user_id, -Number(p.tokens), why, p.stripe_session_id, c);
    }
  });
}

/** Process a verified webhook event. */
export async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await fulfillSession(event.data.object);
      break;
    case 'charge.refunded': {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (pi && charge.refunded) await reversePayment(pi, 'refund');
      break;
    }
    case 'charge.dispute.created': {
      const dispute = event.data.object;
      const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
      if (pi) await reversePayment(pi, 'dispute');
      break;
    }
    default:
      break;
  }
  await requireDb().query('INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [event.id, event.type]);
}
