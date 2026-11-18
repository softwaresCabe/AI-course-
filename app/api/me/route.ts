import { config } from '../../../server/config';
import { json } from '../../../server/http';
import { getViewer } from '../../../server/viewer';
import { balance } from '../../../server/ledger';
import { products } from '../../../server/products';
import type { Me } from '../../../src/lib/platform';

export const dynamic = 'force-dynamic';

/** The viewer's identity, entitlements, token balance and which features this deployment supports. */
export async function GET(req: Request) {
  const v = await getViewer(req);
  const metered = v.signedIn && !v.open && !v.admin && !!v.userId && config.dbEnabled;
  const me: Me = {
    mode: v.open ? 'open' : 'auth',
    signedIn: v.signedIn,
    paid: v.paid,
    admin: v.admin,
    tokens: metered ? { balance: await balance(v.userId!) } : null,
    features: {
      ai: config.aiEnabled && (v.open || config.dbEnabled || v.admin),
      db: config.dbEnabled,
      payments: config.paymentsEnabled && config.dbEnabled && !v.open,
      mcp: config.dbEnabled && !v.open,
    },
    products: config.paymentsEnabled && !v.open ? products() : [],
    supportEmail: config.supportEmail,
  };
  return json(me);
}
