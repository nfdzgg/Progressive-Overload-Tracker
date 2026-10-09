// Slice S6 Session extras: rest timer, notes sheet, skip, swap, deload
// (SPEC 6.3 and the notes and more-menu parts of 6.2). Runs at 390×844.
import type { Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

// 2026-03-02 is a Monday (the template starts on Push).
const MONDAY = new Date('2026-03-02T09:00:00');

interface Data {
  exercises: Array<{
    id: string;
    name: string;
    variants: Array<{ id: string; name: string; note: string }>;
  }>;
  workouts: Array<{ id: string; name: string }>;
  sessions: Array<{ id: string; deload: boolean; status: string }>;
  entries: Array<{
    exerciseId: string;
    swappedFromExerciseId: string | null;
    status: string;
    sets: Array<{ reps: number | null }>;
  }>;
}

interface StoredTimer {
  label: string;
  endsAt: number;
  durationMs: number;
}

const card = (page: Page, name: string) => page.getByRole('article', { name });
const timerBar = (page: Page) => page.getByRole('button', { name: /^Rest timer, / });
const countdown = (page: Page) => timerBar(page).getByRole('timer');
const sheet = (page: Page) => page.getByRole('dialog');

async function readAll(app: App): Promise<Data> {
  return app.call<Data>('readAllData', await app.today());
}

/** The persisted timer and the page clock's now. */
async function storedTimer(page: Page): Promise<{ timer: StoredTimer | null; now: number }> {
  return page.evaluate(() => {
    const text = localStorage.getItem('pot:rest-timer');
    return { timer: text ? (JSON.parse(text) as StoredTimer) : null, now: Date.now() };
  });
}

/** Records sound and vibration instead of producing them. */
async function recordAlerts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sounds: string[]; __vibrations: unknown[] };
    w.__sounds = [];
    w.__vibrations = [];
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      w.__sounds.push(this.muted ? 'muted' : this.currentSrc || this.src);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {};
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: unknown) => {
        w.__vibrations.push(pattern);
        return true;
      },
    });
  });
}

async function alerts(page: Page): Promise<{ sounds: string[]; vibrations: unknown[] }> {
  return page.evaluate(() => {
    const w = window as unknown as { __sounds: string[]; __vibrations: unknown[] };
    return { sounds: w.__sounds.filter((s) => s !== 'muted'), vibrations: w.__vibrations };
  });
}

async function openMore(page: Page, name: string) {
  await card(page, name)
    .getByRole('button', { name: `More for ${name}` })
    .click();
  await expect(sheet(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Fake clock, flowing naturally; fastForward jumps it (like a locked phone).
  await page.clock.install({ time: MONDAY });
});

test('rest timer: starts on a committed set and on Log, on every tab, ends at 0:00, tap dismisses', async ({
  app,
  page,
}) => {
  await recordAlerts(page);
  await app.seed();
  await expect(timerBar(page)).toHaveCount(0);

  // Set 1 filled and blurred: the timer starts with Chest press's rest (2:30).
  const chest = card(page, 'Chest press');
  await chest.getByLabel('Set 1 reps').fill('10');
  await chest.getByLabel('Set 2 reps').click();
  await expect(timerBar(page)).toBeVisible();
  await expect(timerBar(page)).toContainText('Chest press');
  await expect(countdown(page)).toHaveText(/^2:(30|29|28)$/);
  const { timer, now } = await storedTimer(page);
  expect(timer).toMatchObject({ label: 'Chest press', durationMs: 150_000 });
  expect(timer!.endsAt - now).toBeGreaterThan(145_000);

  // Above the tab bar on every tab.
  for (const tab of ['Calendar', 'Progress', 'Settings', 'Today'] as const) {
    await app.tab(tab);
    await expect(countdown(page)).toBeVisible();
    const bar = (await timerBar(page).boundingBox())!;
    const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
  }

  // Time jumps (backgrounded app): the countdown follows the end timestamp.
  await page.clock.fastForward('01:00');
  await expect(countdown(page)).toHaveText(/^1:(30|29|28|27|26)$/);

  // A reload keeps the remaining time.
  await page.reload();
  await expect(countdown(page)).toHaveText(/^1:(29|28|27|26|25|24)$/);

  // Reaching zero: sound and vibration once, then it stays at 0:00.
  const before = await storedTimer(page);
  await page.clock.fastForward(before.timer!.endsAt - before.now + 200);
  await expect(countdown(page)).toHaveText('0:00');
  await expect.poll(async () => (await alerts(page)).vibrations).toHaveLength(1);
  const fired = await alerts(page);
  expect(fired.sounds).toHaveLength(1);
  expect(fired.sounds[0]).toContain('sounds/rest-done.wav');
  await page.clock.fastForward('00:30');
  await expect(countdown(page)).toHaveText('0:00');
  expect((await alerts(page)).vibrations).toHaveLength(1);

  // Tap to dismiss.
  await timerBar(page).click();
  await expect(timerBar(page)).toHaveCount(0);

  // Log starts it again.
  await card(page, 'Chest press').getByLabel('Set 2 reps').fill('9');
  await card(page, 'Chest press').getByRole('button', { name: 'Log Chest press' }).click();
  await expect(timerBar(page)).toContainText('Chest press');
  await expect(countdown(page)).toHaveText(/^2:(30|29|28)$/);

  // A new start replaces the running one (Lateral raise rests 1:30).
  const raise = card(page, 'Lateral raise');
  await raise.getByLabel('Set 1 reps').fill('12');
  await raise.getByLabel('Set 2 reps').click();
  await expect(timerBar(page)).toContainText('Lateral raise');
  await expect(countdown(page)).toHaveText(/^1:(30|29|28)$/);
});

test('rest timer never starts when turned off in Settings', async ({ app, page }) => {
  await app.seed();
  const chest = card(page, 'Chest press');
  await chest.getByLabel('Set 1 reps').fill('10');
  await chest.getByLabel('Set 2 reps').click();
  await expect(timerBar(page)).toBeVisible();

  await app.tab('Settings');
  await page
    .getByRole('radiogroup', { name: 'Rest timer' })
    .getByRole('radio', { name: 'Off' })
    .click();
  // Turning it off removes the running one.
  await expect(timerBar(page)).toHaveCount(0);

  await app.tab('Today');
  await chest.getByLabel('Set 2 reps').fill('9');
  await card(page, 'Incline press').getByLabel('Set 1 reps').fill('8');
  await card(page, 'Incline press').getByLabel('Set 2 reps').click();
  await chest.getByRole('button', { name: 'Log Chest press' }).click();
  await expect(chest.getByText('BW × 10, 9')).toBeVisible();
  await page.clock.fastForward('00:02');
  await expect(timerBar(page)).toHaveCount(0);
  expect((await storedTimer(page)).timer).toBeNull();
});

test('notes sheet saves the note for the selected variant; the icon shows a marker', async ({
  app,
  page,
}) => {
  await app.seed();
  const chest = card(page, 'Chest press');
  const notes = chest.getByRole('button', { name: /^Notes for Chest press/ });
  await expect(notes.getByTestId('icon-marker')).toHaveCount(0);

  await notes.click();
  await expect(sheet(page).getByRole('heading', { name: 'Chest press · Machine' })).toBeVisible();
  await sheet(page).getByLabel('Note').fill('Seat 4, pin 7');
  await sheet(page).getByRole('button', { name: 'Save note' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(notes.getByTestId('icon-marker')).toBeVisible();
  await expect(chest).not.toContainText('Seat 4');

  const { exercises } = await readAll(app);
  const saved = exercises.find((e) => e.name === 'Chest press')!;
  expect(saved.variants.find((v) => v.name === 'Machine')!.note).toBe('Seat 4, pin 7');

  // Notes belong to the variant: Bench has none.
  await chest.getByRole('radio', { name: 'Bench' }).click();
  await expect(notes.getByTestId('icon-marker')).toHaveCount(0);

  // It survives a reload.
  await page.reload();
  await expect(notes.getByTestId('icon-marker')).toBeVisible();
  await notes.click();
  await expect(sheet(page).getByLabel('Note')).toHaveValue('Seat 4, pin 7');
});

test('skip for today marks the card skipped', async ({ app, page }) => {
  await app.seed();
  await openMore(page, 'Incline press');
  await sheet(page).getByRole('button', { name: 'Skip for today' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(card(page, 'Incline press').getByText('Skipped')).toBeVisible();
  const { entries } = await readAll(app);
  expect(entries).toHaveLength(1);
  expect(entries[0].status).toBe('skipped');
});

test('swap for today records the entry against the exercise performed', async ({ app, page }) => {
  await app.seed();
  await openMore(page, 'Chest press');
  await sheet(page).getByRole('button', { name: 'Swap for today' }).click();
  await expect(sheet(page).getByRole('heading', { name: 'Instead of Chest press' })).toBeVisible();
  await sheet(page)
    .getByRole('list', { name: 'Exercises' })
    .getByRole('button', { name: /^Leg press/ })
    .click();

  // The slot now shows the performed exercise, in Chest press's place.
  const legPress = card(page, 'Leg press');
  await expect(legPress).toBeVisible();
  await expect(card(page, 'Chest press')).toHaveCount(0);
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Leg press');

  await legPress.getByLabel('Weight', { exact: true }).fill('200');
  await legPress.getByLabel('Set 1 reps').fill('12');
  await legPress.getByLabel('Set 2 reps').fill('10');
  await legPress.getByRole('button', { name: 'Log Leg press' }).click();
  await expect(legPress.getByText('200 lb × 12, 10')).toBeVisible();

  const { exercises, entries } = await readAll(app);
  const id = (name: string) => exercises.find((e) => e.name === name)!.id;
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    exerciseId: id('Leg press'),
    swappedFromExerciseId: id('Chest press'),
    status: 'logged',
  });
});

test('deload: the badge shows in the top bar and a logged entry earns no PR', async ({
  app,
  page,
}) => {
  await app.seed();
  // History to beat: Chest press, Machine, 100 lb × 10, 9 a few days ago.
  const { exercises, workouts } = await readAll(app);
  const chestPress = exercises.find((e) => e.name === 'Chest press')!;
  const past = await app.call<{ id: string }>(
    'createPastSession',
    '2026-02-26',
    workouts.find((w) => w.name === 'Push')!.id,
  );
  await app.call('addLoggedEntry', {
    sessionId: past.id,
    exerciseId: chestPress.id,
    variantId: chestPress.variants.find((v) => v.name === 'Machine')!.id,
    unit: 'lb',
    weight: 100,
    sets: [
      { reps: 10, weight: null },
      { reps: 9, weight: null },
    ],
  });
  await page.reload();

  const banner = page.getByRole('banner');
  await expect(banner.getByText('Deload')).toHaveCount(0);
  await openMore(page, 'Tricep pushdown');
  await sheet(page)
    .getByRole('button', { name: /^Mark session as deload/ })
    .click();
  await expect(banner.getByText('Deload', { exact: true })).toBeVisible();

  // Beating the reference in a deload session earns no PR badge.
  const chest = card(page, 'Chest press');
  await expect(chest.getByLabel('Weight', { exact: true })).toHaveValue('100');
  await chest.getByLabel('Set 1 reps').fill('12');
  await chest.getByLabel('Set 2 reps').fill('12');
  await chest.getByRole('button', { name: 'Log Chest press' }).click();
  await expect(chest.getByText('100 lb × 12, 12')).toBeVisible();
  await expect(chest.getByText('PR', { exact: true })).toHaveCount(0);

  const { sessions } = await readAll(app);
  expect(sessions.find((s) => s.status === 'inProgress')?.deload).toBe(true);

  // The menu offers to unmark it; the badge goes away.
  await openMore(page, 'Chest fly');
  await sheet(page)
    .getByRole('button', { name: /^Unmark deload/ })
    .click();
  await expect(banner.getByText('Deload')).toHaveCount(0);
});
