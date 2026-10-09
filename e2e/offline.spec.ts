// SPEC 9.4 step 2 / acceptance 2: with the network disabled, the installed
// build loads and logs a session (fonts and the timer sound included).
import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'allow' });

test('works offline after the first load @desktop', async ({ app, page, context }) => {
  // First load online: the service worker installs and precaches everything.
  await app.open();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload once so the page is controlled by the service worker.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // Network off.
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.reload();

  // The app loads from the cache: first run, then the template's Push day.
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();

  // Fonts and the timer sound come from the cache too.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
  const sound = await page.evaluate(async () => {
    // Relative to the app's base path.
    const response = await fetch('sounds/rest-done.wav').catch(() => null);
    return response ? response.status : 0;
  });
  expect(sound).toBe(200);

  // Log a full session offline.
  const cards = page.getByRole('article');
  const count = await cards.count();
  expect(count).toBe(6);
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    await card.getByRole('textbox', { name: 'Weight' }).fill('50');
    await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('10');
    await card.getByRole('textbox', { name: 'Set 2 reps' }).fill('10');
    await card.getByRole('button', { name: /^Log/ }).click();
  }
  await expect(page.getByRole('button', { name: 'Start next workout' })).toBeVisible();

  // Still offline, the data is there after a reload and other tabs work.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start next workout' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Progress' })
    .click();
  await expect(page.getByRole('region', { name: 'This week' })).toContainText('Session');
  const today = await app.today();
  const data = await app.call<{ entries: Array<{ status: string }> }>('readAllData', today);
  expect(data.entries.filter((e) => e.status === 'logged')).toHaveLength(6);
});

test('Chromium reports the app as installable @desktop', async ({ app, page, context }) => {
  await app.open();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  const cdp = await context.newCDPSession(page);
  const manifest = (await cdp.send('Page.getAppManifest')) as {
    errors: Array<{ message: string }>;
  };
  expect(manifest.errors).toEqual([]);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: Array<{ errorId: string }>;
  };
  // Playwright contexts are incognito profiles; that is the only acceptable reason.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual(
    [],
  );
});
