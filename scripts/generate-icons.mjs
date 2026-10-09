#!/usr/bin/env node
// Renders the app icon (canvas background, three ascending lavender bars:
// progressive overload) to the PNG sizes the manifest and iOS need. Colors are
// DESIGN.md canvas (#010102) and primary (#5e6ad2). Run once; output is committed.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = (size, padScale = 1) => {
  // Bars are drawn on a 512 grid and scaled around the center.
  const s = padScale;
  const t = (v) => 256 + (v - 256) * s;
  const bar = (x, y, w, h) =>
    `<rect x="${t(x)}" y="${t(y)}" width="${w * s}" height="${h * s}" rx="${14 * s}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#010102"/>
  <g fill="#5e6ad2">${bar(132, 286, 64, 100)}${bar(224, 216, 64, 170)}${bar(316, 126, 64, 260)}</g>
</svg>`;
};

writeFileSync('public/favicon.svg', svg(512) + '\n');

const targets = [
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/icon-512.png', 512, 1],
  // Maskable icons keep content inside the central safe zone.
  ['public/icons/maskable-512.png', 512, 0.8],
  ['public/icons/apple-touch-icon-180.png', 180, 0.9],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [path, size, scale] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
  await page.screenshot({ path, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path);
}
await browser.close();
