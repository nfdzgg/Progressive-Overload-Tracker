/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo-name>/.
export const BASE_PATH = '/Progressive-Overload-Tracker/';

// DESIGN.md canvas: theme and background color of the installed app.
const CANVAS = '#010102';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const buildId = (process.env.APP_BUILD_ID ?? 'dev').slice(0, 7);

export default defineConfig({
  base: BASE_PATH,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      // The new service worker waits and takes over on the next launch.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'sounds/*.wav'],
      manifest: {
        id: BASE_PATH,
        name: 'Progressive Overload Tracker',
        short_name: 'Overload',
        description:
          'A phone-first gym logger for progressive overload. All data stays on the device.',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait',
        background_color: CANVAS,
        theme_color: CANVAS,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache everything, including fonts and the timer sound.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wav,webmanifest}'],
        navigateFallback: `${BASE_PATH}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    // Component tests drive IndexedDB and userEvent; leave headroom for slow CI runners.
    testTimeout: 15_000,
  },
});
