import { expect, test } from './fixtures';

test('first run is shown on a fresh device @desktop', async ({ app, page }) => {
  await app.open();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('four tabs route to their screens @desktop', async ({ app, page }) => {
  await app.seed();
  await expect(page).toHaveURL(/#\/today$/);
  for (const name of ['Calendar', 'Progress', 'Settings', 'Today'] as const) {
    await app.tab(name);
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page).toHaveURL(new RegExp(`#/${name.toLowerCase()}$`));
  }
});

test('installable: manifest, icons, theme color, standalone', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('./');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#010102');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, baseURL).toString())).json();
  expect(manifest).toMatchObject({
    display: 'standalone',
    theme_color: '#010102',
    background_color: '#010102',
    start_url: '/Progressive-Overload-Tracker/',
  });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(touch!, baseURL).toString())).ok()).toBe(true);
  const sound = await request.get(new URL('sounds/rest-done.wav', baseURL).toString());
  expect(sound.ok()).toBe(true);
});

test('phone layout: no horizontal scroll, tab bar pinned to the bottom', async ({ app, page }) => {
  await app.seed();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  expect(nav).not.toBeNull();
  expect(Math.round(nav!.y + nav!.height)).toBe(844);
  expect(nav!.height).toBeGreaterThanOrEqual(56);
});

test('desktop window keeps a phone-shaped column @desktop', async ({ app, page }) => {
  await app.seed();
  const main = await page.getByRole('main').boundingBox();
  const width = page.viewportSize()!.width;
  expect(main!.width).toBeLessThanOrEqual(480);
  if (width > 480) expect(Math.abs(main!.x + main!.width / 2 - width / 2)).toBeLessThan(2);
});
