import { expect, test, type Page } from '@playwright/test';

// Pages can take a moment to serve a fresh deploy, so keep reloading until the
// page reports the build id of the commit that was just deployed.
async function openCurrentBuild(page: Page) {
  const expectedBuild = (process.env.EXPECTED_BUILD ?? '').slice(0, 7);
  await expect(async () => {
    const response = await page.goto('./', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    if (expectedBuild) {
      const build = await page.evaluate(() => document.documentElement.dataset.build ?? '');
      expect(build).toBe(expectedBuild);
    }
  }).toPass({ timeout: 150_000, intervals: [5_000] });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
  // The iPhone (WebKit) views are also printed to the job log as small JPEGs,
  // so they can be reviewed from the run log without downloading artifacts.
  if (test.info().project.name === 'webkit-iphone') {
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, scale: 'css' });
    console.log(`LIVE_SCREENSHOT ${name} ${jpeg.toString('base64')}`);
  }
}

test('live site: installable, offline-ready, and usable end to end', async ({
  page,
  request,
}, testInfo) => {
  await openCurrentBuild(page);

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
  await shot(page, `${testInfo.project.name}-1-first-run`);
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();
  const press = page.getByRole('article', { name: 'Chest press' });
  await expect(press).toBeVisible();

  // Filling set 1 and leaving the field starts the rest timer above the tab bar.
  await press.getByRole('textbox', { name: 'Weight' }).fill('100');
  await press.getByRole('textbox', { name: 'Set 1 reps' }).fill('10');
  await press.getByRole('textbox', { name: 'Set 2 reps' }).focus();
  await expect(page.getByRole('button', { name: /Rest timer, Chest press/ })).toBeVisible();
  await press.getByRole('textbox', { name: 'Set 2 reps' }).fill('9');
  await press.getByRole('button', { name: /^Log/ }).click();
  await expect(press.getByText('100 lb × 10, 9')).toBeVisible();
  await shot(page, `${testInfo.project.name}-2-today-logged`);

  // The log is stored on the device: it survives a reload.
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Chest press' }).getByText('100 lb × 10, 9'),
  ).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await shot(page, `${testInfo.project.name}-3-calendar`);
  await nav.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
  await shot(page, `${testInfo.project.name}-4-progress`);

  // Settings has the routine and the data section.
  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Routine' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export full backup/ })).toBeVisible();
  await shot(page, `${testInfo.project.name}-5-settings`);
});

test('iPhone: home-screen metadata and icon (WebKit)', async ({ page, request, browserName }) => {
  test.skip(browserName !== 'webkit', 'iPhone checks run in WebKit');
  await openCurrentBuild(page);
  // "Add to Home Screen" uses these: full-screen launch, status bar, icon, title.
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'black-translucent',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    'content',
    'Overload',
  );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const response = await request.get(new URL(icon!, page.url()).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  // PNG header: 180 × 180.
  const png = await response.body();
  expect(png.readUInt32BE(16)).toBe(180);
  expect(png.readUInt32BE(20)).toBe(180);
});

test('desktop: Chromium reports the live app installable', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Installability is queried through Chromium DevTools');
  await openCurrentBuild(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  const cdp = await context.newCDPSession(page);
  const manifest = (await cdp.send('Page.getAppManifest')) as { errors: unknown[] };
  expect(manifest.errors).toEqual([]);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: Array<{ errorId: string }>;
  };
  // Playwright contexts are incognito profiles; that is the only acceptable reason.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual(
    [],
  );

  // Offline: the installed app still opens from the service worker cache.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push' })).toBeVisible();
  await context.setOffline(false);
});
