// Tutor token accounting.
//  - token_balances holds the spendable balance (atomic check-and-reserve under a row lock).
//  - token_ledger is append-only and always sums to the balance: every change, including in-flight
//    holds, is a line. (reason, ref) is unique, so grants and settlements can never double-apply.
// A tutor turn is: hold(-max) → model call → release(+max) + usage(-actual). If the process dies
// mid-turn, the orphaned hold is released automatically on the user's next reservation.
import type { PoolClient } from 'pg';
import { requireDb, tx } from './db';

type Q = Pick<PoolClient, 'query'>;
const STALE_HOLD = "interval '15 minutes'";

export async function balance(userId: string, q: Q = requireDb()): Promise<number> {
  const { rows } = await q.query<{ balance: string }>('SELECT balance FROM token_balances WHERE user_id = $1', [userId]);
  return rows[0] ? Number(rows[0].balance) : 0;
}

async function line(c: Q, userId: string, delta: number, reason: string, ref: string | null, extra?: { model: string; input_tokens: number; output_tokens: number }) {
  const ins = await c.query(
    `INSERT INTO token_ledger (user_id, delta, reason, ref, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (reason, ref) WHERE ref IS NOT NULL DO NOTHING RETURNING id`,
    [userId, delta, reason, ref, extra?.model ?? null, extra?.input_tokens ?? null, extra?.output_tokens ?? null],
  );
  if (!ins.rowCount) return false;
  await c.query(
    `INSERT INTO token_balances (user_id, balance) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + EXCLUDED.balance`,
    [userId, delta],
  );
  return true;
}

/**
 * Add (or remove, with a negative delta) tokens. Idempotent on (reason, ref): repeating a call with the
 * same ref is a no-op and returns false.
 */
export async function credit(userId: string, delta: number, reason: string, ref: string | null, q?: Q): Promise<boolean> {
  return q ? line(q, userId, delta, reason, ref) : tx((c) => line(c, userId, delta, reason, ref));
}

/**
 * Hold up to `max` tokens for request `ref` before calling the model. Returns the amount held, or null
 * if the balance is below `min`. The balance row is locked, so concurrent requests can't spend the
 * same tokens twice.
 */
export async function reserve(userId: string, ref: string, max: number, min = 1): Promise<number | null> {
  return tx(async (c) => {
    const { rows } = await c.query<{ balance: string }>('SELECT balance FROM token_balances WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!rows[0]) return null;
    // Release holds orphaned by a crashed request.
    const stale = await c.query<{ ref: string; amount: string }>(
      `SELECT h.ref, -h.delta AS amount FROM token_ledger h
       WHERE h.user_id = $1 AND h.reason = 'hold' AND h.created_at < now() - ${STALE_HOLD}
         AND NOT EXISTS (SELECT 1 FROM token_ledger r WHERE r.reason = 'release' AND r.ref = h.ref)`,
      [userId],
    );
    for (const s of stale.rows) await line(c, userId, Number(s.amount), 'release', s.ref);
    const bal = await balance(userId, c);
    if (bal < min) return null;
    const held = Math.min(bal, max);
    await line(c, userId, -held, 'hold', ref);
    return held;
  });
}

/**
 * Settle a hold: release it and record actual usage. `used` may exceed `held` (a long answer); the
 * balance can then dip slightly below zero and the next reserve() fails until the user tops up.
 * Idempotent per ref.
 */
export async function settle(userId: string, ref: string, held: number, used: number, detail: { model: string; input_tokens: number; output_tokens: number }) {
  await tx(async (c) => {
    if (!(await line(c, userId, held, 'release', ref))) return; // already settled
    await line(c, userId, -used, 'usage', ref, detail);
  });
}
