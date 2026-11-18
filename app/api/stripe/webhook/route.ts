import { json } from '../../../../server/http';
import { handleEvent, stripe } from '../../../../server/billing';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook. Subscribe to: checkout.session.completed, checkout.session.async_payment_succeeded,
 * charge.refunded, charge.dispute.created. The signature is verified against the raw body.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return json({ error: 'bad_request' }, 400);
  const body = await req.text();
  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, sig, secret);
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }
  try {
    await handleEvent(event);
  } catch (e) {
    console.error('stripe webhook failed', event.type, event.id, e);
    return json({ error: 'processing_failed' }, 500); // Stripe retries
  }
  return json({ received: true });
}
