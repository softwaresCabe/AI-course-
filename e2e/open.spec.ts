// Walks every week of the course end to end, as a learner would, in open (self-study) mode.
import { expect, test, type Page } from '@playwright/test';

const WEEKS = 13;
const errors: string[] = [];

function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
}

async function answerQuiz(page: Page) {
  const cards = page.locator('.card.border-2');
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const option = card.locator('button[type=button]').first();
    if (await option.count()) await option.click();
    const num = card.locator('input[inputmode=decimal]');
    if (await num.count()) await num.fill('1');
    const ta = card.locator('textarea');
    if (await ta.count()) await ta.fill('A short written answer for the end-to-end test.');
  }
  return n;
}

test.describe.configure({ mode: 'serial' });

test('every week: lecture, lab, readings, checklist, review, quiz, tutor', async ({ page }) => {
  watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('AI Engineering');
  const me = await (await page.request.get('/api/me')).json();
  expect(me).toMatchObject({ mode: 'open', paid: true });

  for (let n = 1; n <= WEEKS; n++) {
    await test.step(`week ${n}`, async () => {
      await page.goto(`/#week-${n}`);
      await expect(page.locator('main .kicker').first()).toContainText(`Week ${n}`);
      // Lecture
      const sections = page.locator('main section[id^="sec-"]');
      await expect(sections.first()).toBeVisible();
      const count = await sections.count();
      expect(count).toBeGreaterThanOrEqual(5);
      const html = await page.locator('main .lecture').first().innerHTML();
      expect(html.length).toBeGreaterThan(200);
      // No unrendered markdown emphasis left behind in prose paragraphs
      const raw = await page.locator('main .lecture p').evaluateAll((ps) => ps.map((p) => p.textContent ?? '').filter((t) => /\*\*\S/.test(t)));
      expect(raw, 'unrendered **bold** in lecture').toEqual([]);
      await sections.first().getByLabel('Mark section as read').check();

      // Lab
      await page.getByRole('button', { name: n === 13 ? 'Capstone' : 'Lab', exact: true }).click();
      await expect(page.locator('main h2').first()).toContainText(n === 13 ? 'Capstone' : `Lab ${n}`);
      await expect(page.locator('main ol li').first()).toBeVisible();

      // Readings
      await page.getByRole('button', { name: 'Readings', exact: true }).click();
      await expect(page.locator('main .card').first()).toBeVisible();

      // Checklist
      await page.getByRole('button', { name: 'Checklist', exact: true }).click();
      await page.locator('main input[type=checkbox]').first().check();

      // Review (flashcards + spaced review from earlier weeks)
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Flashcards' })).toBeVisible();
      if (n > 1) await expect(page.locator('main .card.border-2').first()).toBeVisible();

      // Quiz: take it, self-grade the written answer (no AI key in this run), record.
      await page.getByRole('button', { name: 'Quiz', exact: true }).click();
      await page.getByRole('button', { name: /Start quiz|Retake quiz/ }).click();
      const qn = await answerQuiz(page);
      expect(qn).toBeGreaterThanOrEqual(5);
      await page.getByRole('button', { name: 'Submit for grading' }).click();
      await page.getByRole('button', { name: 'Record grade' }).click();
      await expect(page.getByText('Recorded in your gradebook')).toBeVisible();

      // Tutor tab renders (AI disabled in this run)
      await page.getByRole('button', { name: 'AI tutor', exact: true }).click();
      await expect(page.getByText(/AI tutor isn’t enabled/)).toBeVisible();
    });
  }
  await expect(page.getByText('Progress synced')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('gradebook reflects all 13 quizzes and progress syncs to Postgres', async ({ page }) => {
  watch(page);
  await page.goto('/#gradebook');
  const rows = page.locator('table').nth(1).locator('tbody tr');
  await expect(rows).toHaveCount(WEEKS + 2);
  for (let i = 0; i < WEEKS; i++) await expect(rows.nth(i).locator('td').nth(3)).toHaveText(/\d+%/);
  await expect(page.getByText('Progress synced')).toBeVisible({ timeout: 15_000 });
  const saved = await (await page.request.get('/api/progress')).json();
  expect(Object.keys(saved.data.quizzes)).toHaveLength(WEEKS);
  expect(saved.data.read['w1-s0']).toBe(true);
  expect(errors).toEqual([]);
});

test('midterm: timer, answers survive a reload, one attempt recorded', async ({ page }) => {
  watch(page);
  await page.goto('/#midterm');
  await page.getByRole('button', { name: 'Begin exam' }).click();
  await page.getByRole('button', { name: 'Yes, start' }).click();
  await expect(page.locator('.chip.font-mono')).toHaveText(/^\d+:\d\d$/);
  const first = page.locator('.card.border-2').first().locator('button[type=button]').nth(1);
  await first.click();
  await page.reload();
  // Draft restored: the option picked before reloading is still selected.
  await expect(page.locator('.card.border-2').first().locator('button[type=button]').nth(1)).toHaveClass(/border-brand/);
  await answerQuiz(page);
  await page.getByRole('button', { name: 'Submit for grading' }).click();
  await page.getByRole('button', { name: 'Record grade' }).click();
  await page.goto('/#home');
  await page.goto('/#midterm');
  await expect(page.getByText('Recorded score')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin exam' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile layout: menu opens and pages fit the viewport', async ({ page }) => {
  watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of ['home', 'syllabus', 'week-5', 'gradebook', 'future', 'pricing']) {
    await page.goto(`/#${r}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on #${r}`).toBeLessThanOrEqual(1);
  }
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Syllabus/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('AI Engineering');
  expect(errors).toEqual([]);
});
