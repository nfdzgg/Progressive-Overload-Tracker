import type { Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

// 2026-03-04 is a Wednesday; its week starts Monday 2026-03-02.
const WEDNESDAY = new Date('2026-03-04T09:00:00');

interface Routine {
  exercises: Array<{ id: string; name: string; variants: Array<{ id: string; name: string }> }>;
  workouts: Array<{ id: string; name: string }>;
}

type Item = [exercise: string, variant: string, weight: number | null, reps: number[]];

const region = (page: Page, name: string) => page.getByRole('region', { name });

async function logSession(app: App, date: string, workout: string, items: Item[], deload = false) {
  const { exercises, workouts } = await app.call<Routine>('readAllData', await app.today());
  const session = await app.call<{ id: string }>(
    'createPastSession',
    date,
    workouts.find((w) => w.name === workout)!.id,
  );
  if (deload) await app.call('setSessionDeload', session.id, true);
  for (const [name, variant, weight, reps] of items) {
    const exercise = exercises.find((e) => e.name === name)!;
    await app.call('addLoggedEntry', {
      sessionId: session.id,
      exerciseId: exercise.id,
      variantId: exercise.variants.find((v) => v.name === variant)!.id,
      unit: 'lb',
      weight,
      sets: reps.map((r) => ({ reps: r, weight: null })),
    });
  }
}

/**
 * Several weeks of history: Chest press Bench progresses (with a deload),
 * Chest press Machine is stuck at 100 lb (stalled), plus pulldowns and crunches.
 */
async function seedHistory(app: App) {
  await logSession(app, '2025-11-17', 'Push', [['Chest press', 'Bench', 115, [8, 8]]]);
  await logSession(app, '2026-01-12', 'Push', [['Chest press', 'Bench', 120, [8, 8]]]);
  await logSession(app, '2026-02-02', 'Push', [['Chest press', 'Machine', 100, [8, 8]]]);
  await logSession(app, '2026-02-09', 'Push', [
    ['Chest press', 'Machine', 100, [8, 8]],
    ['Chest press', 'Bench', 125, [8, 8]],
  ]);
  await logSession(
    app,
    '2026-02-16',
    'Push',
    [
      ['Chest press', 'Machine', 80, [8, 8]],
      ['Chest press', 'Bench', 100, [8, 8]],
    ],
    true,
  );
  await logSession(app, '2026-02-23', 'Push', [
    ['Chest press', 'Machine', 100, [8, 8]],
    ['Chest press', 'Bench', 130, [8, 8]],
  ]);
  await logSession(app, '2026-02-25', 'Legs', [
    ['Incline bench crunch', 'Incline bench', null, [15, 12]],
  ]);
  await logSession(app, '2026-03-02', 'Push', [
    ['Chest press', 'Machine', 100, [8, 7]],
    ['Chest press', 'Bench', 135, [8, 7]],
  ]);
  await logSession(app, '2026-03-03', 'Pull', [['Lat pulldown', 'Wide grip', 120, [10, 10]]]);
}

const stat = (page: Page, card: string, label: string) =>
  region(page, card).getByText(label, { exact: true }).locator('xpath=preceding-sibling::p');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
});

test('a fresh template install explains each card instead of showing numbers', async ({
  app,
  page,
}) => {
  await app.seed({ route: 'progress' });
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
  await expect(region(page, 'This week')).toContainText('Nothing logged yet');
  await expect(region(page, 'Consistency')).toContainText('No finished sessions yet');
  await expect(region(page, 'Sets per muscle group')).toContainText(
    'No sets this week or last week',
  );
  await expect(region(page, 'Recent PRs')).toContainText('No PRs yet');
  await expect(region(page, 'Exercise detail')).toContainText('No exercise history yet');
  await expect(region(page, 'Volume')).toContainText('No volume yet');
  await expect(region(page, 'Stalled')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('img')).toHaveCount(0);
});

test('shows every section from several weeks of history', async ({ app, page }) => {
  await app.seed({ route: 'progress' });
  await seedHistory(app);

  // 1. This week: Monday's Push and Tuesday's Pull; Bench weight + e1RM PRs; 6 hard sets.
  await expect(stat(page, 'This week', 'Sessions')).toHaveText('2');
  await expect(stat(page, 'This week', 'PRs set')).toHaveText('2');
  await expect(stat(page, 'This week', 'Hard sets')).toHaveText('6');

  // 2. Consistency: 8 weekly bars, this week highlighted, a 5-week streak.
  const consistency = region(page, 'Consistency');
  await expect(consistency.getByText('5 weeks', { exact: true })).toBeVisible();
  const sessions = consistency.getByRole('img');
  await expect(sessions).toHaveAccessibleName(
    'Finished sessions per week: week of 1/12 1, week of 1/19 0, week of 1/26 0, week of 2/2 1, week of 2/9 1, week of 2/16 1, week of 2/23 2, this week 2',
  );
  await expect(sessions.locator('[data-current]')).toHaveCount(1);

  // 3. Sets per muscle group: this week against last week.
  const sets = region(page, 'Sets per muscle group');
  await expect(sets.getByText('6 sets', { exact: true })).toBeVisible();
  await expect(sets.getByRole('img')).toHaveAccessibleName(
    'Hard sets per muscle group, this week against last week: Chest 4 against 4, Back 2 against 0, Abs 0 against 2',
  );

  // 4. Recent PRs: newest first, with variant, type, value, and date.
  const prs = region(page, 'Recent PRs').getByRole('listitem');
  await expect(prs).toHaveCount(8);
  await expect(prs.first()).toContainText('Chest press');
  await expect(prs.first()).toContainText('Bench · Weight PR');
  await expect(prs.first()).toContainText('135 lb');
  await expect(prs.first()).toContainText('Mon, Mar 2');
  await expect(prs.nth(1)).toContainText('Bench · e1RM PR');
  await expect(prs.nth(1)).toContainText('171 lb');

  // 5. Stalled: Machine has four non-deload entries without a new best.
  const stalled = region(page, 'Stalled').getByRole('listitem');
  await expect(stalled).toHaveCount(1);
  await expect(stalled).toContainText('Chest press');
  await expect(stalled).toContainText('Machine');

  // 6. Exercise detail: defaults to the latest logged exercise; pick Chest press, Bench.
  const detail = region(page, 'Exercise detail');
  const exercise = detail.getByLabel('Exercise');
  await expect(exercise.locator('option:checked')).toHaveText('Lat pulldown');
  await exercise.selectOption({ label: 'Chest press' });
  await detail.getByRole('radio', { name: 'Bench' }).click();
  await expect(detail.getByText('Best e1RM', { exact: true })).toBeVisible();
  await expect(detail.getByText('171 lb', { exact: true })).toBeVisible();

  const chart = detail.getByRole('img', { name: /^e1RM and Top weight over time/ });
  const e1rmPoints = chart.locator('[data-series="e1rm"] circle');
  // 3M (default): 5 sessions, 4 PR points, the deload shown muted on both lines.
  await expect(chart).toHaveAccessibleName(/Chest press, Bench: 5 sessions$/);
  await expect(e1rmPoints).toHaveCount(5);
  await expect(chart.locator('circle[data-pr]')).toHaveCount(4);
  await expect(chart.locator('circle[data-muted]')).toHaveCount(2);
  await expect(detail.getByText('Deload', { exact: true }).first()).toBeVisible();

  // The range switch changes the points.
  await detail.getByRole('radio', { name: '1M' }).click();
  await expect(e1rmPoints).toHaveCount(4);
  await expect(chart.locator('circle[data-pr]')).toHaveCount(3);
  await detail.getByRole('radio', { name: 'All' }).click();
  await expect(e1rmPoints).toHaveCount(6);
  await expect(chart.locator('circle[data-pr]')).toHaveCount(4);

  // Full history for the variant, newest first, with Deload and PR badges.
  const history = detail.getByRole('list', { name: 'History for Chest press, Bench' });
  const rows = history.getByRole('listitem');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('Mon, Mar 2');
  await expect(rows.first()).toContainText('135 lb × 8, 7 · e1RM 171 lb');
  await expect(rows.first().getByText('PR', { exact: true })).toBeVisible();
  await expect(rows.nth(2)).toContainText('Mon, Feb 16');
  await expect(rows.nth(2)).toContainText('100 lb × 8, 8');
  await expect(rows.nth(2).getByText('Deload', { exact: true })).toBeVisible();
  await expect(rows.nth(2).getByText('PR', { exact: true })).toHaveCount(0);
  await expect(rows.last()).toContainText('115 lb × 8, 8');

  // 7. Volume: weight × reps per week, this week highlighted.
  const volume = region(page, 'Volume');
  await expect(volume.getByText('5,925 lb', { exact: true })).toBeVisible();
  const bars = volume.getByRole('img');
  await expect(bars).toHaveAccessibleName(/week of 2\/23 3\.7k, this week 5\.9k$/);
  await expect(bars.locator('[data-current]')).toHaveCount(1);

  // Charts never scroll the page sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('cards stack on a phone and go 2-up on a wide window @desktop', async ({ app, page }) => {
  await app.seed({ route: 'progress' });
  await seedHistory(app);
  await expect(region(page, 'Stalled')).toBeVisible();
  const boxes = await page
    .getByRole('main')
    .getByRole('region')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes).toHaveLength(7);
  const main = (await page.getByRole('main').boundingBox())!;
  const lefts = [...new Set(boxes.map((b) => Math.round(b.left)))];
  if (page.viewportSize()!.width >= 768) {
    // Two columns side by side in a column up to 960px wide.
    expect(lefts).toHaveLength(2);
    expect(main.width).toBeLessThanOrEqual(960);
    expect(main.width).toBeGreaterThan(480);
    for (const b of boxes) expect(b.width).toBeLessThan(main.width / 2);
    const [left, right] = lefts.sort((a, b) => a - b);
    const first = boxes.find((b) => Math.round(b.left) === left)!;
    const beside = boxes.find((b) => Math.round(b.left) === right)!;
    expect(beside.top).toBeLessThan(first.bottom);
  } else {
    expect(lefts).toHaveLength(1);
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].bottom - 1);
    }
  }
});
