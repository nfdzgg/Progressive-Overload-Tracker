// Slice S2 Settings: routine, library, cycle editing, restart cycle,
// preferences (SPEC 4.1, 4.3, 6.6 without Data). Runs at 390×844.
import { expect, test, type App } from './fixtures';
import type { Page } from '@playwright/test';

interface Variant {
  id: string;
  name: string;
  archived: boolean;
}
interface Exercise {
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  archived: boolean;
  variants: Variant[];
  defaultVariantId: string;
}
interface Workout {
  id: string;
  name: string;
  exerciseIds: string[];
}
type CycleItem = { kind: 'workout'; workoutId: string } | { kind: 'rest' };
interface Cycle {
  items: CycleItem[];
  pointer: number;
  restartOn: string | null;
}
interface Data {
  exercises: Exercise[];
  workouts: Workout[];
  cycle: Cycle;
  entries: Array<{ exerciseId: string }>;
}

async function data(app: App): Promise<Data> {
  return app.call<Data>('readAllData', await app.today());
}

async function cycleLabels(app: App): Promise<string[]> {
  const d = await data(app);
  return d.cycle.items.map((i) =>
    i.kind === 'rest' ? 'Rest' : d.workouts.find((w) => w.id === i.workoutId)!.name,
  );
}

async function workoutExercises(app: App, name: string): Promise<string[]> {
  const d = await data(app);
  const workout = d.workouts.find((w) => w.name === name)!;
  return workout.exerciseIds.map((id) => d.exercises.find((e) => e.id === id)!.name);
}

/** Marks the document so a later check can prove the page never reloaded. */
async function markDocument(page: Page) {
  await page.evaluate(() => ((window as unknown as { __mark: boolean }).__mark = true));
}
async function expectSameDocument(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __mark?: boolean }).__mark)).toBe(true);
}

const settingsRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) });

test.beforeEach(async ({ app, page }) => {
  await app.seed({ route: 'settings' });
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('create an exercise with type defaults, edit it, add it to a workout and reorder', async ({
  app,
  page,
}) => {
  await markDocument(page);
  await settingsRow(page, 'Exercises').click();
  await page.getByRole('button', { name: 'New exercise' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New exercise' })).toBeVisible();

  // Choosing a type fills in its rep range and rest (SPEC 4.1).
  await page.getByLabel('Name', { exact: true }).fill('Dips');
  await page.getByLabel('Type', { exact: true }).selectOption('legCompound');
  await expect(page.getByLabel('Min reps')).toHaveValue('6');
  await expect(page.getByLabel('Max reps')).toHaveValue('12');
  await expect(page.getByLabel('Rest', { exact: true })).toHaveValue('180');
  await page.getByLabel('Type', { exact: true }).selectOption('smallIsolation');
  await expect(page.getByLabel('Min reps')).toHaveValue('10');
  await expect(page.getByLabel('Max reps')).toHaveValue('15');
  await expect(page.getByLabel('Rest', { exact: true })).toHaveValue('90');
  await expect(page.getByLabel('Sets', { exact: true })).toHaveValue('2');
  await page.getByLabel('Muscle group').selectOption('triceps');
  await page.getByRole('button', { name: 'Create exercise' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dips' })).toBeVisible();

  // Edit sets, rep range (validated), and rest; edits save as they are made.
  await page.getByLabel('Sets', { exact: true }).selectOption('3');
  await page.getByLabel('Min reps').fill('8');
  await page.getByLabel('Max reps').fill('6');
  await expect(page.getByText("Max can't be below min")).toBeVisible();
  await expect(page.getByLabel('Max reps')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Max reps').fill('12');
  await expect(page.getByText("Max can't be below min")).toBeHidden();
  await page.getByLabel('Rest', { exact: true }).selectOption('120');
  await expect
    .poll(async () => (await data(app)).exercises.find((e) => e.name === 'Dips'))
    .toMatchObject({ sets: 3, repMin: 8, repMax: 12, restSeconds: 120, archived: false });

  // Add it to Push from the picker, then move it up one place.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Exercises' })).toBeVisible();
  await expect(settingsRow(page, 'Dips')).toContainText('Triceps · 3 × 8–12 · 2:00 rest');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await settingsRow(page, 'Workouts').click();
  await settingsRow(page, 'Push').click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog', { name: 'Add to Push' });
  await expect(picker.getByRole('button', { name: 'Add Chest press' })).toHaveCount(0);
  await picker.getByRole('button', { name: 'Add Dips' }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('listitem', { name: 'Dips' })).toBeVisible();
  await expect.poll(async () => (await workoutExercises(app, 'Push')).at(-1)).toBe('Dips');
  await page.getByRole('button', { name: 'Move Dips up' }).click();
  await expect
    .poll(async () => (await workoutExercises(app, 'Push')).slice(-2))
    .toEqual(['Dips', 'Tricep pushdown']);

  // The edits are live (no reload): leave Settings and come back.
  await app.tab('Today');
  await app.tab('Settings');
  await settingsRow(page, 'Workouts').click();
  await expect(settingsRow(page, 'Push')).toContainText('7 exercises');
  await expectSameDocument(page);

  // No horizontal scrolling at phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a data change shows in Settings without a reload (live queries)', async ({ app, page }) => {
  await markDocument(page);
  await settingsRow(page, 'Exercises').click();
  await expect(settingsRow(page, 'Row')).toContainText('Back · 2 × 6–12');
  const row = (await data(app)).exercises.find((e) => e.name === 'Row')!;
  await app.call('updateExercise', row.id, { sets: 4, repMin: 5, repMax: 8 });
  await expect(settingsRow(page, 'Row')).toContainText('Back · 4 × 5–8');
  await expectSameDocument(page);
});

test('reorder, add, and remove cycle items', async ({ app, page }) => {
  await settingsRow(page, 'Cycle').click();
  await expect(page.getByRole('listitem', { name: '1. Push' })).toContainText('Next');

  await page
    .getByRole('listitem', { name: '1. Push' })
    .getByRole('button', { name: 'Move Push down' })
    .click();
  await expect
    .poll(() => cycleLabels(app))
    .toEqual(['Pull', 'Push', 'Legs', 'Push', 'Pull', 'Legs', 'Rest']);
  // The pointer stays on the same item (Push), now second.
  expect((await data(app)).cycle.pointer).toBe(1);
  await expect(page.getByRole('listitem', { name: '2. Push' })).toContainText('Next');

  await page
    .getByRole('listitem', { name: '7. Rest' })
    .getByRole('button', { name: 'Remove Rest from the cycle' })
    .click();
  await expect.poll(() => cycleLabels(app)).toHaveLength(6);

  await page.getByRole('button', { name: 'Add to cycle' }).click();
  await page
    .getByRole('dialog', { name: 'Add to cycle' })
    .getByRole('button', { name: 'Rest day' })
    .click();
  await page.getByRole('button', { name: 'Add to cycle' }).click();
  await page
    .getByRole('dialog', { name: 'Add to cycle' })
    .getByRole('button', { name: 'Legs' })
    .click();
  await expect
    .poll(() => cycleLabels(app))
    .toEqual(['Pull', 'Push', 'Legs', 'Push', 'Pull', 'Legs', 'Rest', 'Legs']);
  expect((await data(app)).cycle.pointer).toBe(1);
  await expect(page.getByRole('listitem', { name: '8. Legs' })).toBeVisible();
});

test('preferences: unit, rest timer, timer sound', async ({ app, page }) => {
  const unit = page.getByRole('radiogroup', { name: 'Unit' });
  await expect(unit.getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true');
  await unit.getByRole('radio', { name: 'kg' }).click();
  await expect(unit.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await app.call<{ unit: string }>('getSettings')).unit).toBe('kg');

  await page
    .getByRole('radiogroup', { name: 'Rest timer' })
    .getByRole('radio', { name: 'Off' })
    .click();
  await page
    .getByRole('radiogroup', { name: 'Timer sound' })
    .getByRole('radio', { name: 'Off' })
    .click();
  await expect
    .poll(async () => app.call('getSettings'))
    .toMatchObject({ unit: 'kg', restTimerEnabled: false, restTimerSound: false });
});

test('restart cycle today and on Monday, each with a confirmation', async ({ app, page }) => {
  const today = await app.today();
  const cycle = (await data(app)).cycle;
  await app.call('saveCycleItems', cycle.items, today, 2);
  await expect(page.getByText('Next up: Legs. Restarting goes back to Push.')).toBeVisible();

  // Cancel leaves the cycle alone.
  await page.getByRole('button', { name: 'Restart today' }).click();
  let dialog = page.getByRole('alertdialog', { name: 'Restart cycle today?' });
  await expect(dialog).toContainText('Today becomes Push, the first item in your cycle');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect((await data(app)).cycle.pointer).toBe(2);

  // Restart today: pointer = 0 now.
  await page.getByRole('button', { name: 'Restart today' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Restart cycle today?' });
  await dialog.getByRole('button', { name: 'Restart today' }).click();
  await expect.poll(async () => (await data(app)).cycle.pointer).toBe(0);
  await expect(page.getByText('Next up: Push, the first item.')).toBeVisible();

  // Restart on Monday: schedules restartOn for the coming Monday.
  const monday = await app.call<string>('nextMonday', today);
  const mondayLabel = await app.call<string>('formatDate', monday);
  await page.getByRole('button', { name: 'Restart on Monday' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Restart on Monday?' });
  await expect(dialog).toContainText(`Until ${mondayLabel}, Today shows a rest day`);
  await dialog.getByRole('button', { name: 'Restart on Monday' }).click();
  await expect.poll(async () => (await data(app)).cycle.restartOn).toBe(monday);
  await expect(page.getByText(`Restarts from Push on ${mondayLabel}.`)).toBeVisible();
});

test('an exercise with history is archived; one without is deleted', async ({ app, page }) => {
  const today = await app.today();
  const before = await data(app);
  const pull = before.workouts.find((w) => w.name === 'Pull')!;
  const row = before.exercises.find((e) => e.name === 'Row')!;
  const hammer = before.exercises.find((e) => e.name === 'Hammer curl')!;
  const session = await app.call<{ id: string }>('ensureSession', pull.id, today);
  await app.call(
    'logEntry',
    {
      sessionId: session.id,
      slotExerciseId: row.id,
      exerciseId: row.id,
      variantId: row.defaultVariantId,
      unit: 'lb',
      weight: 120,
      sets: [
        { reps: 10, weight: null },
        { reps: 9, weight: null },
      ],
    },
    today,
  );

  await settingsRow(page, 'Exercises').click();
  await settingsRow(page, 'Row').click();
  await page.getByRole('button', { name: 'Archive exercise' }).click();
  let dialog = page.getByRole('alertdialog', { name: 'Archive Row?' });
  await expect(dialog).toContainText('has logged history, so it is archived');
  await dialog.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Exercises' })).toBeVisible();
  await expect(settingsRow(page, 'Row')).toHaveCount(0);
  await expect
    .poll(async () => (await data(app)).exercises.find((e) => e.id === row.id)?.archived)
    .toBe(true);
  let after = await data(app);
  expect(after.workouts.find((w) => w.id === pull.id)!.exerciseIds).not.toContain(row.id);
  expect(after.entries.filter((e) => e.exerciseId === row.id)).toHaveLength(1);

  await settingsRow(page, 'Hammer curl').click();
  await page.getByRole('button', { name: 'Delete exercise' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Delete Hammer curl?' });
  await expect(dialog).toContainText('no logged history, so it is deleted for good');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(settingsRow(page, 'Hammer curl')).toHaveCount(0);
  await expect
    .poll(async () => (await data(app)).exercises.some((e) => e.id === hammer.id))
    .toBe(false);
  after = await data(app);
  expect(after.workouts.find((w) => w.id === pull.id)!.exerciseIds).not.toContain(hammer.id);

  // Archived exercises are gone from the workout picker too.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await settingsRow(page, 'Workouts').click();
  await settingsRow(page, 'Push').click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog', { name: 'Add to Push' });
  await expect(picker.getByRole('button', { name: 'Add Lat pulldown' })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Add Row' })).toHaveCount(0);
});
