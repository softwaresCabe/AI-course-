// Who is making this request, and what are they allowed to do?
import { createHash } from 'node:crypto';
import { config } from './config';
import { db } from './db';
import { credit } from './ledger';
import { primaryEmail, sessionUserId } from './clerk';
import type { Entitlement } from '../src/lib/access';

export interface Viewer extends Entitlement {
  userId: string | null;
  admin: boolean;
  /** Open mode: no accounts, nothing metered. */
  open: boolean;
  via: 'open' | 'session' | 'api_key' | 'anonymous';
}

const ANON: Viewer = { userId: null, signedIn: false, paid: false, admin: false, open: false, via: 'anonymous' };
export const OPEN_VIEWER: Viewer = { userId: 'local', signedIn: true, paid: true, admin: true, open: true, via: 'open' };

export const API_KEY_PREFIX = 'aie_';
export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');

/**
 * Resolve the viewer. API keys (Authorization: Bearer aie_…) are accepted only where `allowApiKey` is
 * set (the MCP endpoint); browser routes use the Clerk session.
 */
export async function getViewer(req: Request, { allowApiKey = false } = {}): Promise<Viewer> {
  if (config.openAccess) return OPEN_VIEWER;

  if (allowApiKey) {
    const authz = req.headers.get('authorization') ?? '';
    const key = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
    if (key.startsWith(API_KEY_PREFIX)) return viewerForApiKey(key);
  }

  if (!config.authEnabled) return ANON;
  const userId = await sessionUserId();
  if (!userId) return ANON;
  return viewerForUser(userId, 'session');
}

async function viewerForApiKey(key: string): Promise<Viewer> {
  const pool = db();
  if (!pool) return ANON;
  const { rows } = await pool.query<{ user_id: string }>(
    'UPDATE api_keys SET last_used_at = now() WHERE hash = $1 AND revoked_at IS NULL RETURNING user_id',
    [hashKey(key)],
  );
  if (!rows[0]) return ANON;
  return viewerForUser(rows[0].user_id, 'api_key');
}

/** Load (creating on first sight) the user's row, entitlement and admin status. */
export async function viewerForUser(userId: string, via: Viewer['via']): Promise<Viewer> {
  const admins = config.admins;
  const pool = db();
  if (!pool) {
    // Accounts without a database: identity works, but purchases can't be recorded — only admins get in.
    const admin = admins.includes(userId.toLowerCase()) || (admins.some((a) => a.includes('@')) && admins.includes((await primaryEmail(userId)) ?? ''));
    return { userId, signedIn: true, paid: admin, admin, open: false, via };
  }

  let { rows } = await pool.query<{ email: string | null; paid: boolean }>(
    `SELECT u.email, (e.user_id IS NOT NULL AND e.revoked_at IS NULL) AS paid
     FROM users u LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  if (!rows[0]) {
    await ensureUser(userId);
    ({ rows } = await pool.query(
      `SELECT u.email, (e.user_id IS NOT NULL AND e.revoked_at IS NULL) AS paid
       FROM users u LEFT JOIN entitlements e ON e.user_id = u.id WHERE u.id = $1`,
      [userId],
    ));
  }
  let email = rows[0]?.email ?? null;
  if (!email && admins.some((a) => a.includes('@'))) {
    // Email wasn't verified at sign-up; re-check so ADMIN_EMAILS can still match later.
    email = await primaryEmail(userId);
    if (email) await pool.query('UPDATE users SET email = $2 WHERE id = $1', [userId, email]);
  }
  const admin = admins.includes(userId.toLowerCase()) || (!!email && admins.includes(email));
  return { userId, signedIn: true, paid: admin || !!rows[0]?.paid, admin, open: false, via };
}

/** First sign-in: create the user row and grant starter tutor tokens (exactly once). */
export async function ensureUser(userId: string) {
  const pool = db();
  if (!pool) return;
  const email = await primaryEmail(userId);
  const ins = await pool.query('INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id', [userId, email]);
  if (ins.rowCount && config.signupTokens > 0) await credit(userId, config.signupTokens, 'signup_grant', userId);
}
