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

  // The app renders (first run on a fresh device).
  await expect(page.locator('#root h1').first()).toBeVisible();

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
});
