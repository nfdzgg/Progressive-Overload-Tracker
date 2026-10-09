import { expect, test } from '@playwright/test';

test('kitchen sink shows the shared components @desktop', async ({ page }) => {
  await page.goto('./#/kitchen-sink');
  await expect(page.getByRole('heading', { level: 1, name: 'Kitchen sink' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Variant' })).toBeVisible();
  await page.getByRole('button', { name: 'Open sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'Chest press · Machine' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // No horizontal scrolling at phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
