import { z } from 'zod';
import { config } from '../../../server/config';
import { json, readJson, sameOrigin } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { CheckoutError, createCheckout } from '../../../server/billing';

export const dynamic = 'force-dynamic';

const Body = z.object({ product: z.string().min(1).max(40) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (!config.paymentsEnabled || !config.dbEnabled) return json({ error: 'payments_disabled' }, 501);
  const body = Body.safeParse(await readJson(req, 2_000));
  if (!body.success) return json({ error: 'bad_request' }, 400);
  try {
    return json({ url: await createCheckout(await getViewer(req), body.data.product) });
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.message }, e.status);
    console.error('checkout error', e);
    return json({ error: 'checkout_failed' }, 502);
  }
}
