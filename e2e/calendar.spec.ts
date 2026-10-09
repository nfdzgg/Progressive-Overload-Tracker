// Slice S4 Calendar: month and week views, projection, day sheets, editing
// past entries, adding a past session (SPEC 5.2, 6.4). Runs at 390×844.
import type { Locator, Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

// 2026-03-04 is a Wednesday.
const WEDNESDAY = new Date('2026-03-04T09:00:00');
const MONDAY = '2026-03-02';

interface Data {
  exercises: Array<{ id: string; name: string; variants: Array<{ id: string; name: string }> }>;
  workouts: Array<{ id: string; name: string }>;
  sessions: Array<{ date: string; workoutName: string; status: string }>;
  entries: Array<{
    date: string;
    exerciseId: string;
    status: string;
    weight: number | null;
    unit: string;
    sets: Array<{ reps: number | null }>;
  }>;
}

async function readAll(app: App): Promise<Data> {
  return app.call<Data>('readAllData', await app.today());
}

/** A finished session on a past day with logged entries. */
async function seedSession(
  app: App,
  date: string,
  workoutName: string,
  entries: Array<{ exercise: string; variant: string; weight: number | null; reps: number[] }>,
) {
  const { exercises, workouts } = await readAll(app);
  const workout = workouts.find((w) => w.name === workoutName)!;
  const session = await app.call<{ id: string }>('createPastSession', date, workout.id);
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

const week = (page: Page) => page.getByRole('region', { name: 'This week' });
const month = (page: Page, name = 'March 2026') => page.getByRole('region', { name });
const sheet = (page: Page, name: string) => page.getByRole('dialog', { name });
const day = (region: Locator, name: string) => region.getByRole('button', { name, exact: true });

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
});

test("today's finished session is marked; the projection starts tomorrow in cycle order", async ({
  app,
  page,
}) => {
  await app.seed({ route: 'calendar' });
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  // Before training, today shows the workout at the pointer.
  await expect(day(week(page), 'Wednesday, March 4, today, Push, planned')).toBeVisible();

  const today = await app.today();
  const { exercises, workouts } = await readAll(app);
  const push = workouts.find((w) => w.name === 'Push')!;
  const chest = exercises.find((e) => e.name === 'Chest press')!;
  const session = await app.call<{ id: string }>('ensureSession', push.id, today);
  await app.call(
    'logEntry',
    {
      sessionId: session.id,
      slotExerciseId: chest.id,
      exerciseId: chest.id,
      variantId: chest.variants[0].id,
      unit: 'lb',
      weight: 100,
      sets: [
        { reps: 10, weight: null },
        { reps: 9, weight: null },
      ],
    },
    today,
  );
  // In progress: labelled, but no finished marker yet.
  const inProgress = day(week(page), 'Wednesday, March 4, today, Push, in progress');
  await expect(inProgress).toBeVisible();
  await expect(inProgress.getByTestId('completed-dot')).toHaveCount(0);

  await app.call('finishSession', session.id, today);
  const finished = day(week(page), 'Wednesday, March 4, today, Push, finished');
  await expect(finished).toBeVisible();
  await expect(finished.getByTestId('completed-dot')).toBeVisible();
  await expect(finished).toHaveAttribute('aria-current', 'date');

  const upcoming = [
    'Thursday, March 5, Pull, planned',
    'Friday, March 6, Legs, planned',
    'Saturday, March 7, Push, planned',
    'Sunday, March 8, Pull, planned',
    'Monday, March 9, Legs, planned',
    'Tuesday, March 10, Rest',
    'Wednesday, March 11, Push, planned',
  ];
  for (const name of upcoming) await expect(day(month(page), name)).toBeVisible();
  await expect(day(month(page), 'Tuesday, March 10, Rest')).toHaveText('10Rest');
  await expectNoSideScroll(page);

  // The month moves on; the week strip stays on this week.
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(day(month(page, 'April 2026'), 'Wednesday, April 1, Push, planned')).toBeVisible();
  await expect(day(week(page), 'Wednesday, March 4, today, Push, finished')).toBeVisible();
});

test("a past day's entries can be edited and deleted", async ({ app, page }) => {
  await app.seed({ route: 'calendar' });
  await seedSession(app, MONDAY, 'Push', [
    { exercise: 'Chest press', variant: 'Machine', weight: 100, reps: [10, 9] },
    { exercise: 'Lateral raise', variant: 'Cable', weight: 15, reps: [12, 12] },
  ]);
  await day(week(page), 'Monday, March 2, Push, finished').click();

  const monday = sheet(page, 'Monday, March 2');
  await expect(monday.getByRole('heading', { name: 'Push' })).toBeVisible();
  await expect(monday.getByRole('button', { name: 'Incline press, Not logged' })).toBeVisible();
  await monday.getByRole('button', { name: 'Chest press, Machine · 100 lb × 10, 9' }).click();

  const editor = sheet(page, 'Chest press');
  await expect(editor.getByLabel('Weight', { exact: true })).toHaveValue('100');
  await editor.getByLabel('Set 2 reps').fill('11');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(
    monday.getByRole('button', { name: 'Chest press, Machine · 100 lb × 10, 11' }),
  ).toBeVisible();

  await monday.getByRole('button', { name: 'Lateral raise, Cable · 15 lb × 12, 12' }).click();
  await sheet(page, 'Lateral raise').getByRole('button', { name: 'Delete entry' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete this entry?' });
  await confirm.getByRole('button', { name: 'Delete entry' }).click();
  await expect(monday.getByRole('button', { name: 'Lateral raise, Not logged' })).toBeVisible();

  const { entries } = await readAll(app);
  expect(entries.map((e) => [e.weight, e.sets.map((s) => s.reps), e.status])).toEqual([
    [100, [10, 11], 'logged'],
  ]);
});

test('a session added to an empty past day is logged without moving the cycle', async ({
  app,
  page,
}) => {
  await app.seed({ route: 'calendar' });
  const today = await app.today();
  const before = await app.call('getCycle', today);

  await day(week(page), 'Tuesday, March 3').click();
  const tuesday = sheet(page, 'Tuesday, March 3');
  await expect(tuesday.getByText(/Nothing logged on this day/)).toBeVisible();
  await tuesday.getByRole('button', { name: 'Add Pull' }).click();

  await expect(tuesday.getByRole('heading', { name: 'Pull' })).toBeVisible();
  await tuesday.getByRole('button', { name: 'Lat pulldown, Not logged' }).click();
  const editor = sheet(page, 'Lat pulldown');
  await editor.getByLabel('Weight', { exact: true }).fill('120');
  await editor.getByLabel('Set 1 reps').fill('10');
  await editor.getByLabel('Set 2 reps').fill('8');
  await editor.getByRole('button', { name: 'Log' }).click();
  await expect(
    tuesday.getByRole('button', { name: 'Lat pulldown, Wide grip · 120 lb × 10, 8' }),
  ).toBeVisible();

  const data = await readAll(app);
  expect(data.sessions).toMatchObject([
    { date: '2026-03-03', workoutName: 'Pull', status: 'finished' },
  ]);
  expect(data.entries).toMatchObject([
    { date: '2026-03-03', status: 'logged', weight: 120, unit: 'lb' },
  ]);
  expect(await app.call('getCycle', today)).toEqual(before);

  await page.keyboard.press('Escape');
  await expect(tuesday).toHaveCount(0);
  await expect(day(week(page), 'Tuesday, March 3, Pull, finished')).toBeVisible();
  // Today still shows the workout at the pointer.
  await expect(day(week(page), 'Wednesday, March 4, today, Push, planned')).toBeVisible();
});

test('a future day opens a read-only planned list; no sideways scroll at 320px @desktop', async ({
  app,
  page,
}) => {
  await app.seed({ route: 'calendar' });
  await day(week(page), 'Thursday, March 5, Pull, planned').click();
  const thursday = sheet(page, 'Thursday, March 5');
  await expect(thursday.getByRole('heading', { name: 'Pull' })).toBeVisible();
  await expect(thursday.getByRole('listitem')).toHaveCount(6);
  await expect(thursday.getByRole('listitem').first()).toHaveText('Lat pulldown2 sets · 6–12 reps');
  await expect(thursday.getByRole('button')).toHaveCount(0);
  await expect(thursday.getByRole('textbox')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(thursday).toHaveCount(0);

  await day(month(page), 'Tuesday, March 10, Rest').click();
  await expect(sheet(page, 'Tuesday, March 10').getByText('Rest day')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(day(month(page), 'Tuesday, March 31, Rest')).toBeVisible();
  await expectNoSideScroll(page);
});
