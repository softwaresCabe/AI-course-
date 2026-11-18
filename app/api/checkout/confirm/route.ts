import { z } from 'zod';
import { config } from '../../../../server/config';
import { json, readJson, sameOrigin } from '../../../../server/http';
import { getViewer } from '../../../../server/viewer';
import { fulfillSession, stripe } from '../../../../server/billing';

export const dynamic = 'force-dynamic';

const Body = z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/) });

/**
 * Called by the success page so access unlocks immediately, even if the webhook is delayed.
 * Only fulfils a session that belongs to the signed-in user; the webhook remains the source of truth.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  if (!config.paymentsEnabled || !config.dbEnabled) return json({ error: 'payments_disabled' }, 501);
  const v = await getViewer(req);
  if (!v.signedIn || !v.userId) return json({ error: 'signin_required' }, 401);
  const body = Body.safeParse(await readJson(req, 2_000));
  if (!body.success) return json({ error: 'bad_request' }, 400);
  try {
    const session = await stripe().checkout.sessions.retrieve(body.data.sessionId);
    if ((session.metadata?.userId ?? session.client_reference_id) !== v.userId) return json({ error: 'not_found' }, 404);
    return json({ status: await fulfillSession(session) });
  } catch (e) {
    console.error('checkout confirm error', e);
    return json({ error: 'confirm_failed' }, 502);
  }
}
