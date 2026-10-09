#!/usr/bin/env node
// Acceptance 1 on desktop: installs the app as a desktop web app in a real
// Chromium profile and launches it the way the OS shortcut does, then checks
// that the window runs standalone (no browser UI) and renders the app.
//
// Chromium installs the app because of a WebAppInstallForceList policy that
// the caller writes first (CI does this for the live URL), e.g.
//   /etc/chromium/policies/managed/pot.json:
//   {"WebAppInstallForceList":[{"url":"<app url>","default_launch_container":"window"}]}
// Run under a display (CI: `xvfb-run -a node scripts/verify-desktop-install.mjs`).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_NAME = 'Progressive Overload Tracker';
const APP_PATH = '/Progressive-Overload-Tracker/';
const exe = process.env.CHROME_PATH ?? chromium.executablePath();
const profile = mkdtempSync(join(tmpdir(), 'pot-desktop-install-'));
const port = 9341;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function start(extraArgs) {
  return spawn(
    exe,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-sandbox',
      '--no-first-run',
      ...extraArgs,
    ],
    { stdio: 'ignore' },
  );
}

async function connect() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }
  throw new Error('Chromium did not start');
}

// 1. Start the browser; the policy installs the app into this profile.
let proc = start(['about:blank']);
let browser = await connect();
const page = await browser.contexts()[0].newPage();
await sleep(8000); // let the policy installer fetch the manifest first
let appId = null;
let details = '';
for (let i = 0; i < 60 && !appId; i += 1) {
  await page.goto('chrome://web-app-internals');
  await page
    .waitForFunction(() => document.body.innerText.includes('InstalledWebApps'), null, {
      timeout: 5000,
    })
    .catch(() => {});
  details = await page.evaluate(() => document.body.innerText);
  appId = details.match(new RegExp(`"${APP_NAME}"\\s*:\\s*"([a-p]{32})"`))?.[1] ?? null;
  if (!appId) await sleep(1000);
}
await browser.close().catch(() => {});
proc.kill();
if (!appId) {
  console.error('FAIL: the app was not installed');
  process.exit(1);
}
const field = (key) => details.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))?.[1];
console.log(`Installed "${APP_NAME}" as a desktop app (id ${appId})`);
console.log(
  `  display_mode: ${field('display_mode')}, user_display_mode: ${field('user_display_mode')}`,
);
console.log(`  start_url: ${field('start_url')}`);
if (field('display_mode') !== 'standalone') {
  console.error('FAIL: the installed app does not declare standalone display');
  process.exit(1);
}
await sleep(1500);

// 2. Launch the installed app by id, like its OS shortcut.
proc = start([`--app-id=${appId}`]);
browser = await connect();
let window = null;
for (let i = 0; i < 40 && !window; i += 1) {
  for (const p of browser.contexts().flatMap((c) => c.pages())) {
    const info = await p
      .evaluate(() => ({
        url: location.href,
        standalone: matchMedia('(display-mode: standalone)').matches,
        heading: document.querySelector('h1')?.textContent ?? null,
      }))
      .catch(() => null);
    if (info?.url.includes(APP_PATH) && info.heading) window = info;
  }
  if (!window) await sleep(500);
}
await browser.close().catch(() => {});
proc.kill();
if (!window) {
  console.error('FAIL: launching the installed app opened no app window');
  process.exit(1);
}
console.log(`Launched app window: ${JSON.stringify(window)}`);
if (!window.standalone) {
  console.error('FAIL: the app window is not standalone');
  process.exit(1);
}
console.log('PASS: installs as a desktop app and opens standalone');
