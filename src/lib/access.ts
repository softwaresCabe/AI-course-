// Access policy shared by the client (to show locks) and the server (to enforce them).
// The server is the source of truth: gated content is only ever sent by /api/content after these checks.

export type AccessLevel = 'public' | 'account' | 'paid';

/** Week 1 is open to everyone (no sign-in), Week 2 needs a free account, everything else is part of the paid course. */
export function weekAccess(n: number): AccessLevel {
  if (n === 1) return 'public';
  if (n === 2) return 'account';
  return 'paid';
}

export const EXAM_ACCESS: AccessLevel = 'paid';

export interface Entitlement {
  /** Signed in (or running in open/local mode). */
  signedIn: boolean;
  /** Owns the full course (purchased, admin, or open mode). */
  paid: boolean;
}

export function canAccess(level: AccessLevel, e: Entitlement): boolean {
  if (level === 'public') return true;
  if (level === 'account') return e.signedIn;
  return e.paid;
}

/** Why access was denied — drives the 401 vs 402 response and the upsell UI. */
export function denial(level: AccessLevel, e: Entitlement): 'signin_required' | 'purchase_required' | null {
  if (canAccess(level, e)) return null;
  return e.signedIn ? 'purchase_required' : 'signin_required';
}
