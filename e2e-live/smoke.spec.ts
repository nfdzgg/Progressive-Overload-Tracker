import { expect, test } from '@playwright/test';

// Pages can take a moment to serve a fresh deploy, so keep reloading until the
// page reports the build id of the commit that was just deployed.
test('live site serves the current build', async ({ page }) => {
  const expectedBuild = (process.env.EXPECTED_BUILD ?? '').slice(0, 7);
  await expect(async () => {
    const response = await page.goto('./', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    if (expectedBuild) {
      const build = await page.evaluate(() => document.documentElement.dataset.build ?? '');
      expect(build).toBe(expectedBuild);
    }
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  await expect(page.getByRole('heading', { name: 'Overload' })).toBeVisible();
});
