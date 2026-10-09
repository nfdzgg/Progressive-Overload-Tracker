// SPEC 9.4 step 1: one journey through the whole product.
// First run with the template → log a full Push session → PR badge and rest
// timer → pointer advances → calendar shows it → Progress reflects it → edit an
// exercise in Settings → export, wipe, import, and confirm identical data.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const MONDAY = new Date('2026-03-02T10:00:00');
const TUESDAY = new Date('2026-03-03T10:00:00');

const PUSH: Array<{ name: string; weight: string; reps: [string, string] }> = [
  { name: 'Chest press', weight: '100', reps: ['10', '9'] },
  { name: 'Incline press', weight: '80', reps: ['10', '10'] },
  { name: 'Chest fly', weight: '50', reps: ['12', '12'] },
  { name: 'Lateral raise', weight: '15', reps: ['12', '12'] },
  { name: 'Tricep overhead cable extension', weight: '30', reps: ['12', '12'] },
  { name: 'Tricep pushdown', weight: '40', reps: ['12', '12'] },
];

const card = (page: Page, name: string) => page.getByRole('article', { name });
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

test('the whole product, end to end @desktop', async ({ app, page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(MONDAY);

  // First run: Push / Pull / Legs template, lb.
  await app.open();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Push / Pull / Legs template' })).toBeChecked();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();

  // Something to beat: log yesterday's Chest press after the fact from the calendar.
  await nav(page).getByRole('link', { name: 'Calendar' }).click();
  await page
    .getByRole('region', { name: 'March 2026' })
    .getByRole('button', { name: 'Sunday, March 1', exact: true })
    .click();
  const sunday = page.getByRole('dialog', { name: 'Sunday, March 1' });
  await sunday.getByRole('button', { name: 'Add Push' }).click();
  await sunday.getByRole('button', { name: 'Chest press, Not logged' }).click();
  const editor = page.getByRole('dialog', { name: 'Chest press' });
  await editor.getByLabel('Weight', { exact: true }).fill('100');
  await editor.getByLabel('Set 1 reps').fill('8');
  await editor.getByLabel('Set 2 reps').fill('8');
  await editor.getByRole('button', { name: 'Log' }).click();
  await expect(
    sunday.getByRole('button', { name: 'Chest press, Machine · 100 lb × 8, 8' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Log a full Push session: one weight and reps per set per exercise.
  await nav(page).getByRole('link', { name: 'Today' }).click();
  const press = card(page, 'Chest press');
  await expect(press.getByText('Last: 100 lb × 8, 8')).toBeVisible();
  await expect(press.getByRole('textbox', { name: 'Weight' })).toHaveValue('100');
  await expect(press.getByRole('textbox', { name: 'Set 1' })).toHaveAttribute('placeholder', '8');

  for (const [index, exercise] of PUSH.entries()) {
    const c = card(page, exercise.name);
    await c.getByRole('textbox', { name: 'Weight' }).fill(exercise.weight);
    await c.getByRole('textbox', { name: 'Set 1' }).fill(exercise.reps[0]);
    await c.getByRole('textbox', { name: 'Set 2' }).fill(exercise.reps[1]);
    if (index === 0) {
      // Set 1 was filled and lost focus: the rest timer runs with the exercise's rest (2:30).
      await expect(
        page.getByRole('button', { name: /Rest timer, Chest press, 2:30/ }),
      ).toBeVisible();
    }
    if (index < PUSH.length - 1) {
      await c.getByRole('button', { name: 'Log' }).click();
      await expect(c.getByRole('textbox', { name: 'Weight' })).toHaveCount(0);
    }
    if (index === 0) {
      // 10 reps at 100 lb beats the 8 from yesterday: a PR.
      await expect(c.getByText('100 lb × 10, 9')).toBeVisible();
      await expect(c.getByText('PR', { exact: true })).toBeVisible();
    }
  }
  // Logging the last card finishes the session automatically.
  await card(page, 'Tricep pushdown').getByRole('button', { name: 'Log' }).click();
  await expect(page.getByRole('button', { name: 'Start next workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rest timer, Tricep pushdown/ })).toBeVisible();

  // The calendar shows the finished session today and the projection from the advanced pointer.
  await nav(page).getByRole('link', { name: 'Calendar' }).click();
  const week = page.getByRole('region', { name: 'This week' });
  await expect(
    week.getByRole('button', { name: 'Monday, March 2, today, Push, finished' }),
  ).toBeVisible();
  await expect(week.getByRole('button', { name: 'Tuesday, March 3, Pull, planned' })).toBeVisible();

  // Progress reflects it: one session this week, 12 hard sets, the Chest press PR.
  await nav(page).getByRole('link', { name: 'Progress' }).click();
  const thisWeek = page.getByRole('region', { name: 'This week' });
  await expect(thisWeek.getByText('Session', { exact: true })).toBeVisible();
  await expect(thisWeek.getByText('12', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent PRs' })).toContainText('Chest press');

  // Next day: the pointer moved on to Pull.
  await page.clock.setFixedTime(TUESDAY);
  await page.reload();
  await nav(page).getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pull' })).toBeVisible();
  const pulldown = card(page, 'Lat pulldown');
  await expect(pulldown.getByRole('textbox', { name: /^Set \d reps$/ })).toHaveCount(2);

  // Edit an exercise in Settings; Today picks it up without a reload.
  await page.evaluate(() => ((window as unknown as { __mark: boolean }).__mark = true));
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /^Exercises/ }).click();
  await page.getByRole('button', { name: /^Lat pulldown/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lat pulldown' })).toBeVisible();
  await page.getByLabel('Sets', { exact: true }).selectOption('3');
  await nav(page).getByRole('link', { name: 'Today' }).click();
  await expect(pulldown.getByRole('textbox', { name: /^Set \d reps$/ })).toHaveCount(3);
  expect(await page.evaluate(() => (window as unknown as { __mark?: boolean }).__mark)).toBe(true);

  // Export, wipe, import: identical data.
  const today = await app.today();
  const before = await app.call('readAllData', today);
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Export full backup/ }).click(),
  ]);
  const backup = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(backup).data.entries.length).toBeGreaterThan(0);

  await app.call('wipeAllData');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await page.getByText('Start blank', { exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /^Import backup/ }).click(),
  ]);
  await chooser.setFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page
    .getByRole('alertdialog', { name: 'Replace everything?' })
    .getByRole('button', { name: 'Replace everything' })
    .click();
  await expect(page.getByText(/Backup imported/)).toBeVisible();
  expect(await app.call('readAllData', today)).toEqual(before);

  // And the restored data is what Today shows.
  await nav(page).getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pull' })).toBeVisible();
  await expect(
    card(page, 'Lat pulldown').getByRole('textbox', { name: /^Set \d reps$/ }),
  ).toHaveCount(3);
});
