import type { Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

// 2026-03-02 is a Monday.
const MONDAY = new Date('2026-03-02T09:00:00');
const TUESDAY = new Date('2026-03-03T09:00:00');
const NEXT_MONDAY = new Date('2026-03-09T09:00:00');

const PUSH = [
  'Chest press',
  'Incline press',
  'Chest fly',
  'Lateral raise',
  'Tricep overhead cable extension',
  'Tricep pushdown',
];

interface Routine {
  exercises: Array<{ id: string; name: string; variants: Array<{ id: string; name: string }> }>;
  workouts: Array<{ id: string; name: string }>;
  entries: Array<{ status: string; weight: number | null; sets: Array<{ reps: number | null }> }>;
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const card = (page: Page, name: string) => page.getByRole('article', { name });

async function readAll(app: App): Promise<Routine> {
  return app.call<Routine>('readAllData', await app.today());
}

/** A finished Push session a few days ago with logged entries (per variant). */
async function seedHistory(
  app: App,
  date: string,
  entries: Array<{ exercise: string; variant: string; weight: number | null; reps: number[] }>,
) {
  const { exercises, workouts } = await readAll(app);
  const push = workouts.find((w) => w.name === 'Push')!;
  const session = await app.call<{ id: string }>('createPastSession', date, push.id);
  for (const e of entries) {
    const exercise = exercises.find((x) => x.name === e.exercise)!;
    await app.call('addLoggedEntry', {
      sessionId: session.id,
      exerciseId: exercise.id,
      variantId: exercise.variants.find((v) => v.name === e.variant)!.id,
      unit: 'lb',
      weight: e.weight,
      sets: e.reps.map((reps) => ({ reps, weight: null })),
    });
  }
}

async function moveCycleTo(app: App, index: number) {
  const today = await app.today();
  const cycle = await app.call<{ items: unknown[] }>('getCycle', today);
  await app.call('saveCycleItems', cycle.items, today, index);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MONDAY);
});

test('logs a full Push session: cards collapse, the session finishes, the pointer advances', async ({
  app,
  page,
}) => {
  await app.seed();
  await expect(heading(page, 'Push')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(PUSH.length);

  for (const [i, name] of PUSH.entries()) {
    const weight = 40 + i * 5;
    const c = card(page, name);
    await c.getByLabel('Weight', { exact: true }).fill(String(weight));
    await c.getByLabel('Set 1 reps').fill('10');
    await c.getByLabel('Set 2 reps').fill('9');
    await c.getByRole('button', { name: `Log ${name}` }).click();
    if (i < PUSH.length - 1) {
      // Done state: the logged numbers replace the input row.
      await expect(c.getByText(`${weight} lb × 10, 9`)).toBeVisible();
      await expect(c.getByLabel('Weight', { exact: true })).toHaveCount(0);
    }
  }

  // Every card logged: the session finished on its own.
  await expect(page.getByText('Workout finished')).toBeVisible();
  await expect(heading(page, 'Push')).toBeVisible();
  const summary = page.getByRole('list', { name: 'Finished workout' });
  await expect(summary.getByRole('listitem')).toHaveCount(PUSH.length);
  await expect(summary.getByRole('listitem').first()).toContainText('Chest press');
  await expect(summary.getByRole('listitem').first()).toContainText('40 lb × 10, 9');
  await expect(summary.getByRole('listitem').last()).toContainText('65 lb × 10, 9');
  await expect(page.getByRole('button', { name: 'Start next workout' })).toBeVisible();
  const { entries } = await readAll(app);
  expect(entries.filter((e) => e.status === 'logged')).toHaveLength(PUSH.length);

  // The next day shows the next workout in the cycle.
  await page.clock.setFixedTime(TUESDAY);
  await page.reload();
  await expect(heading(page, 'Pull')).toBeVisible();
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Lat pulldown');
});

test('drafts survive a reload; an untouched day leaves no session @desktop', async ({
  app,
  page,
}) => {
  await app.seed();
  await expect(heading(page, 'Push')).toBeVisible();
  expect(await app.call('getInProgressSession')).toBeUndefined();

  const chest = card(page, 'Chest press');
  await chest.getByLabel('Weight', { exact: true }).fill('82.5');
  await chest.getByLabel('Set 1 reps').fill('12');
  await expect
    .poll(async () =>
      (await readAll(app)).entries.map((e) => [e.status, e.weight, e.sets.map((s) => s.reps)]),
    )
    .toEqual([['draft', 82.5, [12, null]]]);

  await page.reload();
  await expect(heading(page, 'Push')).toBeVisible();
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('82.5');
  await expect(chest.getByLabel('Set 1 reps')).toHaveValue('12');
  await expect(chest.getByLabel('Set 2 reps')).toHaveValue('');
});

test('variant history is separate: chips swap reference, target, and prefill', async ({
  app,
  page,
}) => {
  await app.seed();
  await seedHistory(app, '2026-02-26', [
    { exercise: 'Chest press', variant: 'Machine', weight: 100, reps: [10, 9] },
    { exercise: 'Chest press', variant: 'Bench', weight: 135, reps: [12, 12] },
    { exercise: 'Lateral raise', variant: 'Cable', weight: 15, reps: [14, 12] },
  ]);
  await page.reload();
  await expect(heading(page, 'Push')).toBeVisible();

  const chest = card(page, 'Chest press');
  await expect(chest.getByRole('radio', { name: 'Machine' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(chest).toContainText('Last: 100 lb × 10, 9 · Beat: +1 rep');
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('100');
  await expect(chest.getByLabel('Set 1 reps')).toHaveValue('');
  await expect(chest.getByLabel('Set 1 reps')).toHaveAttribute('placeholder', '10');
  await expect(chest.getByLabel('Set 2 reps')).toHaveAttribute('placeholder', '9');

  await chest.getByRole('radio', { name: 'Bench' }).click();
  await expect(chest).toContainText('Last: 135 lb × 12, 12');
  await expect(chest.getByText('Add weight')).toBeVisible();
  await expect(chest).not.toContainText('Beat');
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('135');
  await expect(chest.getByLabel('Set 1 reps')).toHaveAttribute('placeholder', '12');

  const raise = card(page, 'Lateral raise');
  await expect(raise).toContainText('Last: 15 lb × 14, 12');
  await raise.getByRole('radio', { name: 'Machine' }).click();
  await expect(raise.getByText('Nothing logged this way yet')).toBeVisible();
  await expect(raise.getByLabel('Weight', { exact: true })).toHaveValue('');
  await expect(raise.getByLabel('Set 1 reps')).toHaveAttribute('placeholder', 'Set 1');
  await raise.getByRole('radio', { name: 'Cable' }).click();
  await expect(raise.getByLabel('Weight', { exact: true })).toHaveValue('15');

  // Chip taps alone start no session.
  expect(await app.call('getInProgressSession')).toBeUndefined();
});

test('beating history shows the PR badge, which survives a reload; done cards reopen', async ({
  app,
  page,
}) => {
  await app.seed();
  await seedHistory(app, '2026-02-26', [
    { exercise: 'Chest press', variant: 'Machine', weight: 100, reps: [10, 9] },
  ]);
  await page.reload();

  const chest = card(page, 'Chest press');
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('100');
  await expect(chest.getByRole('button', { name: 'Log Chest press' })).toBeDisabled();
  await chest.getByLabel('Set 1 reps').fill('11');
  await chest.getByLabel('Set 2 reps').fill('9');
  await chest.getByRole('button', { name: 'Log Chest press' }).click();
  await expect(chest.getByText('100 lb × 11, 9')).toBeVisible();
  await expect(chest.getByText('PR', { exact: true })).toBeVisible();

  await page.reload();
  await expect(chest.getByText('PR', { exact: true })).toBeVisible();

  // Tapping the done card reopens it with the logged numbers.
  await chest.getByRole('button', { name: 'Edit Chest press' }).click();
  await expect(chest.getByLabel('Set 1 reps')).toHaveValue('11');
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('100');
});

test('rest day: Train anyway starts the next workout', async ({ app, page }) => {
  await app.seed();
  await moveCycleTo(app, 6); // Push, Pull, Legs, Push, Pull, Legs, Rest
  await page.reload();
  await expect(heading(page, 'Rest day')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Train anyway' }).click();
  await expect(heading(page, 'Push')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(PUSH.length);
});

test('scheduled restart: waiting state with Start now', async ({ app, page }) => {
  await app.seed();
  await moveCycleTo(app, 2);
  await app.call('restartCycleOnMonday', await app.today());
  await page.reload();
  await expect(heading(page, 'Rest')).toBeVisible();
  await expect(page.getByText('The cycle restarts Mon, Mar 9')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start now' }).click();
  await expect(heading(page, 'Push')).toBeVisible();
});

test('scheduled restart takes effect on Monday', async ({ app, page }) => {
  await app.seed();
  await moveCycleTo(app, 2);
  await app.call('restartCycleOnMonday', await app.today());
  await page.reload();
  await expect(heading(page, 'Rest')).toBeVisible();
  await page.clock.setFixedTime(NEXT_MONDAY);
  await page.reload();
  await expect(heading(page, 'Push')).toBeVisible();
});
