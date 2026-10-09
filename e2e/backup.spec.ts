// Slice S3 Backup: first run (SPEC 6.1) and Settings → Data (SPEC 6.6),
// including acceptance 3 (template matches section 7) and 11 (export → wipe →
// import restores identical data; routine-only export contains no logs).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

interface Data {
  exercises: Array<{ id: string; name: string; defaultVariantId: string }>;
  workouts: Array<{ id: string; name: string; exerciseIds: string[] }>;
  cycle: { items: Array<{ kind: string }>; pointer: number };
  sessions: unknown[];
  entries: unknown[];
  settings: { unit: string; onboarded: boolean; lastExportAt: string | null };
}

interface Exported {
  name: string;
  text: string;
}

const CSV_HEADER = 'date,workout,exercise,variant,set,reps,weight,unit,deload,swapped_from';

const readAll = async (app: App) => app.call<Data>('readAllData', await app.today());

const row = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${title}`) });

/** Taps an export row and returns the downloaded file (headless Chromium has no Web Share). */
async function exportVia(page: Page, title: string): Promise<Exported> {
  const [download] = await Promise.all([page.waitForEvent('download'), row(page, title).click()]);
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), 'utf8'),
  };
}

/** Taps an import row and picks `file` in the file chooser. */
async function importVia(page: Page, title: string, file: Exported): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), row(page, title).click()]);
  await chooser.setFiles({
    name: file.name,
    mimeType: 'application/json',
    buffer: Buffer.from(file.text),
  });
}

/** A lastExportAt timestamp `days` days ago in the page's clock. */
const exportedDaysAgo = (page: Page, days: number) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }, days);

/**
 * Logs history in two past Push sessions; returns the number of logged sets
 * with reps (the CSV has one row for each).
 */
async function seedHistory(app: App): Promise<number> {
  const today = await app.today();
  const data = await readAll(app);
  const push = data.workouts.find((w) => w.name === 'Push')!;
  let rows = 0;
  for (const [daysAgo, weight] of [
    [9, 100],
    [2, 105],
  ]) {
    const date = await app.call<string>('addDays', today, -daysAgo);
    const session = await app.call<{ id: string }>('createPastSession', date, push.id);
    for (const exerciseId of push.exerciseIds.slice(0, 3)) {
      const exercise = data.exercises.find((e) => e.id === exerciseId)!;
      await app.call('addLoggedEntry', {
        sessionId: session.id,
        exerciseId,
        variantId: exercise.defaultVariantId,
        unit: 'lb',
        weight,
        sets: [
          { reps: 10, weight: null },
          { reps: daysAgo === 2 ? null : 8, weight: null },
        ],
      });
      rows += daysAgo === 2 ? 1 : 2;
    }
  }
  return rows;
}

test.describe('first run', () => {
  test('template and kg: tabs appear and the template matches section 7 @desktop', async ({
    app,
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __persistCalls: number };
      w.__persistCalls = 0;
      const storage = navigator.storage;
      if (storage?.persist) {
        const original = storage.persist.bind(storage);
        storage.persist = () => {
          w.__persistCalls += 1;
          return original();
        };
      }
    });
    await app.open();
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Push / Pull / Legs template' })).toBeChecked();
    await expect(page.getByText('Push, Pull, Legs, Push, Pull, Legs, Rest')).toBeVisible();
    await page.getByRole('radio', { name: 'kg' }).click();
    await expect(page.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Get started' }).click();

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    const data = await readAll(app);
    expect(data.exercises).toHaveLength(16);
    expect(data.workouts.map((w) => w.name).sort()).toEqual(['Legs', 'Pull', 'Push']);
    expect(data.cycle.items).toHaveLength(7);
    expect(data.cycle.items.map((i) => i.kind)).toEqual([
      'workout',
      'workout',
      'workout',
      'workout',
      'workout',
      'workout',
      'rest',
    ]);
    expect(data.settings).toMatchObject({ unit: 'kg', onboarded: true });
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __persistCalls: number }).__persistCalls),
      )
      .toBe(1);
  });

  test('start blank: empty library', async ({ app, page }) => {
    await app.open();
    await page.getByText('Start blank', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Start blank' })).toBeChecked();
    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    const data = await readAll(app);
    expect(data.exercises).toHaveLength(0);
    expect(data.workouts).toHaveLength(0);
    expect(data.cycle.items).toHaveLength(0);
    expect(data.settings).toMatchObject({ unit: 'lb', onboarded: true });
  });
});

test.describe('Settings → Data', () => {
  test('full backup: export → wipe → import restores identical data', async ({ app, page }) => {
    await app.seed({ route: 'settings' });
    const today = await app.today();
    await seedHistory(app);
    await app.call('updateSettings', { restTimerSound: false });
    const before = await readAll(app);

    await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const backup = await exportVia(page, 'Export full backup');
    expect(backup.name).toBe(`overload-backup-${today}.json`);
    expect(JSON.parse(backup.text)).toMatchObject({ kind: 'backup', schemaVersion: 1 });
    await expect(page.getByText('Backup exported.')).toBeVisible();
    await expect(page.getByText(await app.call<string>('formatDate', today))).toBeVisible();
    expect((await readAll(app)).settings.lastExportAt).not.toBeNull();

    // Wipe, then a blank start so Settings is reachable.
    await app.call('wipeAllData');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
    await app.call('completeFirstRun', 'blank', 'lb', today);
    await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();
    expect((await readAll(app)).exercises).toHaveLength(0);

    await importVia(page, 'Import backup', backup);
    const dialog = page.getByRole('alertdialog', { name: 'Replace everything?' });
    await expect(dialog).toContainText('replaces everything on this device');
    await expect(dialog).toContainText(backup.name);
    await dialog.getByRole('button', { name: 'Replace everything' }).click();
    await expect(page.getByText(/Backup imported/)).toBeVisible();
    expect(await readAll(app)).toEqual(before);
  });

  test('routine only: no logs in the file, and importing it back keeps history', async ({
    app,
    page,
  }) => {
    await app.seed({ route: 'settings' });
    const today = await app.today();
    await seedHistory(app);

    const routine = await exportVia(page, 'Export routine only');
    expect(routine.name).toBe(`overload-routine-${today}.json`);
    const file = JSON.parse(routine.text);
    expect(file.kind).toBe('routine');
    expect(file.data).not.toHaveProperty('sessions');
    expect(file.data).not.toHaveProperty('entries');
    expect(file.data).not.toHaveProperty('settings');
    expect(routine.text).not.toContain('"sessionId"');
    expect(file.data.exercises).toHaveLength(16);
    expect(file.data.workouts).toHaveLength(3);
    expect(file.data.cycleItems).toHaveLength(7);
    await expect(page.getByText('Routine exported.')).toBeVisible();
    // Not a restorable backup, so it does not reset the reminder.
    expect((await readAll(app)).settings.lastExportAt).toBeNull();

    // The routine on the device changes; importing the file replaces it again.
    await app.call('saveCycleItems', [{ kind: 'rest' }], today);
    const before = await readAll(app);
    await importVia(page, 'Import routine', routine);
    const dialog = page.getByRole('alertdialog', { name: 'Import routine?' });
    await expect(dialog).toContainText('matched to your exercises by name');
    await expect(dialog).toContainText('cycle and workouts are replaced');
    await dialog.getByRole('button', { name: 'Import routine' }).click();
    await expect(
      page.getByText('Routine imported: 16 exercises matched by name (history kept).'),
    ).toBeVisible();

    const after = await readAll(app);
    expect(after.entries).toEqual(before.entries);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.exercises.map((e) => e.id)).toEqual(before.exercises.map((e) => e.id));
    expect(after.workouts).toHaveLength(3);
    expect(after.cycle.items).toHaveLength(7);
    expect(after.cycle.pointer).toBe(0);
  });

  test('logs CSV: header and one row per logged set', async ({ app, page }) => {
    await app.seed({ route: 'settings' });
    const today = await app.today();
    const sets = await seedHistory(app);

    const csv = await exportVia(page, 'Export logs');
    expect(csv.name).toBe(`overload-logs-${today}.csv`);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(sets + 1);
    const firstDate = await app.call<string>('addDays', today, -9);
    expect(lines[1]).toBe(`${firstDate},Push,Chest press,Machine,1,10,100,lb,false,`);
    await expect(page.getByText('Logs exported.')).toBeVisible();
    expect((await readAll(app)).settings.lastExportAt).toBeNull();
  });

  test('reminder row: after logging with no export, and when the export is over 14 days old', async ({
    app,
    page,
  }) => {
    await app.seed({ route: 'settings' });
    const today = await app.today();
    const reminder = page.getByText('Time for a backup');
    await expect(row(page, 'Export full backup')).toBeVisible();
    await expect(page.getByText('Never')).toBeVisible();
    await expect(reminder).toHaveCount(0);

    await seedHistory(app);
    await expect(reminder).toBeVisible();
    await expect(page.getByText(/never been exported/)).toBeVisible();

    await app.call('updateSettings', { lastExportAt: await exportedDaysAgo(page, 14) });
    const fourteenDaysAgo = await app.call<string>('addDays', today, -14);
    await expect(
      page.getByText(await app.call<string>('formatDate', fourteenDaysAgo)),
    ).toBeVisible();
    await expect(reminder).toHaveCount(0);

    await app.call('updateSettings', { lastExportAt: await exportedDaysAgo(page, 15) });
    await expect(reminder).toBeVisible();
    await expect(page.getByText('Last export was 15 days ago', { exact: false })).toBeVisible();

    // Never on Today.
    await app.tab('Today');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(reminder).toHaveCount(0);

    // A full backup export clears it.
    await app.tab('Settings');
    await expect(reminder).toBeVisible();
    await exportVia(page, 'Export full backup');
    await expect(reminder).toHaveCount(0);
    await expect(page.getByText(await app.call<string>('formatDate', today))).toBeVisible();
  });
});
