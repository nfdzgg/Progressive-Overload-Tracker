import { defineConfig } from '@playwright/test';

// Smoke test against the deployed GitHub Pages site (run from CI after deploy).
const liveURL = process.env.LIVE_URL ?? 'https://nfdzgg.github.io/Progressive-Overload-Tracker/';

export default defineConfig({
  testDir: 'e2e-live',
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: liveURL.endsWith('/') ? liveURL : `${liveURL}/`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
});
