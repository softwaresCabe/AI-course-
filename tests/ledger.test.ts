import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, hasDb, resetDb, useProdEnv } from './helpers';
import { balance, credit, reserve, settle } from '../server/ledger';
import { requireDb } from '../server/db';

describe.skipIf(!hasDb)('token ledger', () => {
  beforeAll(() => useProdEnv());
  beforeEach(async () => {
    await resetDb();
    await requireDb().query("INSERT INTO users (id) VALUES ('u1')");
  });
  afterAll(closeDb);

  const ledgerSum = async (u: string) => Number((await requireDb().query('SELECT coalesce(sum(delta),0) AS s FROM token_ledger WHERE user_id = $1', [u])).rows[0].s);

  it('credits idempotently on (reason, ref)', async () => {
    expect(await credit('u1', 1000, 'purchase', 'cs_1')).toBe(true);
    expect(await credit('u1', 1000, 'purchase', 'cs_1')).toBe(false);
    expect(await credit('u1', 500, 'purchase', 'cs_2')).toBe(true);
    expect(await balance('u1')).toBe(1500);
    expect(await ledgerSum('u1')).toBe(1500);
  });

  it('reserves, then settles to actual usage (ledger always sums to balance)', async () => {
    await credit('u1', 10_000, 'purchase', 'cs_1');
    const held = await reserve('u1', 'req1', 8_000, 100);
    expect(held).toBe(8_000);
    expect(await balance('u1')).toBe(2_000);
    await settle('u1', 'req1', held!, 3_000, { model: 'm', input_tokens: 1, output_tokens: 1 });
    expect(await balance('u1')).toBe(7_000);
    expect(await ledgerSum('u1')).toBe(7_000);
    // settling twice is a no-op
    await settle('u1', 'req1', held!, 3_000, { model: 'm', input_tokens: 1, output_tokens: 1 });
    expect(await balance('u1')).toBe(7_000);
  });

  it('holds at most the remaining balance and refuses below the minimum', async () => {
    await credit('u1', 5_000, 'purchase', 'cs_1');
    expect(await reserve('u1', 'r1', 80_000, 100)).toBe(5_000);
    expect(await reserve('u1', 'r2', 80_000, 100)).toBeNull();
    expect(await reserve('nobody', 'r3', 10, 1)).toBeNull();
  });

  it('does not let concurrent requests double-spend', async () => {
    await credit('u1', 10_000, 'purchase', 'cs_1');
    const results = await Promise.all([...Array(8)].map((_, i) => reserve('u1', `c${i}`, 4_000, 2_000)));
    const held = results.filter((x): x is number => x !== null);
    expect(held.reduce((s, x) => s + x, 0)).toBeLessThanOrEqual(10_000);
    expect(held.length).toBe(3); // 4000 + 4000 + 2000; then balance 0 < min
    expect(await balance('u1')).toBe(0);
    expect(await ledgerSum('u1')).toBe(0);
  });

  it('lets usage overshoot the hold (balance dips negative, then reserve refuses)', async () => {
    await credit('u1', 3_000, 'purchase', 'cs_1');
    const held = await reserve('u1', 'r1', 80_000, 100);
    await settle('u1', 'r1', held!, 4_000, { model: 'm', input_tokens: 1, output_tokens: 1 });
    expect(await balance('u1')).toBe(-1_000);
    expect(await reserve('u1', 'r2', 80_000, 1)).toBeNull();
  });

  it('releases holds orphaned by a crashed request', async () => {
    await credit('u1', 10_000, 'purchase', 'cs_1');
    await reserve('u1', 'crashed', 6_000, 100);
    expect(await balance('u1')).toBe(4_000);
    await requireDb().query("UPDATE token_ledger SET created_at = now() - interval '1 hour' WHERE ref = 'crashed'");
    const held = await reserve('u1', 'next', 1_000, 100);
    expect(held).toBe(1_000);
    expect(await balance('u1')).toBe(9_000);
    expect(await ledgerSum('u1')).toBe(9_000);
  });
});
