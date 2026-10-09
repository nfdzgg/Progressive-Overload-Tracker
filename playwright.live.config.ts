import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the deployed GitHub Pages site (run from CI after deploy):
// an iPhone-sized Chromium, an iPhone 13 in WebKit (Safari's engine), and a
// desktop Chromium window. Screenshots land in test-results/live for review.
const liveURL = process.env.LIVE_URL ?? 'https://nfdzgg.github.io/Progressive-Overload-Tracker/';

export default defineConfig({
  testDir: 'e2e-live',
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  outputDir: 'test-results/live',
  use: {
    baseURL: liveURL.endsWith('/') ? liveURL : `${liveURL}/`,
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'chromium-desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
});
