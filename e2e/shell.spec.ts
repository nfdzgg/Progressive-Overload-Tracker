import { expect, test } from '@playwright/test';

test('app loads @desktop', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Overload' })).toBeVisible();
});
