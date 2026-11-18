// A production deployment with no Clerk keys and no OPEN_ACCESS must fail closed.
import { expect, test } from '@playwright/test';

test('free tier is open; everything else is locked, in the UI and the API', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  expect((await request.get('/api/content/week/1')).status()).toBe(200);
  expect((await request.get('/api/content/week/2')).status()).toBe(401);
  expect((await request.get('/api/content/week/9')).status()).toBe(401);
  expect((await request.get('/api/content/exam/final')).status()).toBe(401);
  expect((await request.post('/api/tutor', { data: { week: 1, messages: [{ role: 'user', content: 'hi' }] } })).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).status()).toBe(401);
  const me = await (await request.get('/api/me')).json();
  expect(me).toMatchObject({ mode: 'auth', signedIn: false, paid: false });

  await page.goto('/#week-1');
  await expect(page.locator('main section[id^="sec-"]').first()).toBeVisible();

  await page.goto('/#week-2');
  await expect(page.getByText('Sign in to open Week 2')).toBeVisible();
  await expect(page.locator('main section[id^="sec-"]')).toHaveCount(0);

  await page.goto('/#week-9');
  await expect(page.getByText('Sign in to open Week 9')).toBeVisible();
  await expect(page.getByText('Lecture outline')).toBeVisible();

  await page.goto('/#final');
  await expect(page.getByText(/Sign in to open the final exam/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin exam' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
