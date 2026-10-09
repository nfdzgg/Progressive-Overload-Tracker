import { expect, test } from '@playwright/test';

// Pages can take a moment to serve a fresh deploy, so keep reloading until the
// page reports the build id of the commit that was just deployed.
test('live site serves the current build and is installable', async ({ page, request }) => {
  const expectedBuild = (process.env.EXPECTED_BUILD ?? '').slice(0, 7);
  await expect(async () => {
    const response = await page.goto('./', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    if (expectedBuild) {
      const build = await page.evaluate(() => document.documentElement.dataset.build ?? '');
      expect(build).toBe(expectedBuild);
    }
  }).toPass({ timeout: 150_000, intervals: [5_000] });

  // Manifest is served and standalone.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest.display).toBe('standalone');

  // The service worker installs (offline support).
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  expect(scope).toContain('/Progressive-Overload-Tracker/');

  // First run → template → Today shows the first workout's cards.
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chest press' })).toBeVisible();

  // Filling set 1 and leaving the field starts the rest timer above the tab bar.
  await page.getByRole('textbox', { name: 'Set 1' }).first().fill('10');
  await page.getByRole('textbox', { name: 'Set 2' }).first().focus();
  await expect(page.getByRole('button', { name: /Rest timer, Chest press/ })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await nav.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();

  // Settings has the routine and the data section.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click();
  await expect(page.getByRole('heading', { name: 'Routine' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export full backup/ })).toBeVisible();
});
