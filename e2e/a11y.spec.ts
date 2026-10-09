// SPEC 9.4 step 4: accessibility pass. Labels on all inputs and icon buttons
// (axe), focus order, 44px tap targets, and reduced motion, on every screen.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test, type App } from './fixtures';

const NOW = new Date('2026-03-11T10:00:00');

interface Seeded {
  workouts: Array<{ id: string; exerciseIds: string[] }>;
  exercises: Array<{ id: string; defaultVariantId: string }>;
}

/** Some history so every screen has content: three past sessions. */
async function seedWithHistory(app: App) {
  await app.seed();
  const today = await app.today();
  const data = await app.call<Seeded>('readAllData', today);
  for (const [i, days] of [9, 6, 2].entries()) {
    const workout = data.workouts[i % data.workouts.length];
    const date = await app.call<string>('addDays', today, -days);
    const session = await app.call<{ id: string }>('createPastSession', date, workout.id);
    for (const exerciseId of workout.exerciseIds.slice(0, 3)) {
      const exercise = data.exercises.find((e) => e.id === exerciseId)!;
      await app.call('addLoggedEntry', {
        sessionId: session.id,
        exerciseId,
        variantId: exercise.defaultVariantId,
        unit: 'lb',
        weight: 80 + days,
        sets: [
          { reps: 10, weight: null },
          { reps: 9, weight: null },
        ],
      });
    }
  }
}

async function axe(page: Page, context: string) {
  // Color contrast is excluded on purpose: DESIGN.md decides colors, and two of
  // its required pairs sit below 4.5:1 (ink-tertiary text for "nothing yet"
  // lines and projected calendar days; the lavender active-tab label). See
  // PROGRESS.md. Every other axe rule must pass.
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const problems = results.violations.map(
    (v) =>
      `${context}: ${v.id} (${v.impact}) — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(problems, problems.join('\n')).toEqual([]);
}

/** Every visible interactive element is at least 44px tall (chips: their hit area). */
async function targets(page: Page, context: string) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type=hidden]):not([type=radio]):not([type=file]), select, textarea, [role=radio]',
    );
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      if (r.height >= 44) continue;
      // Chips look 34px tall but extend their hit area to 44px with ::after.
      const after = getComputedStyle(el, '::after');
      const hit = r.height - parseFloat(after.top) - parseFloat(after.bottom);
      if (after.content !== 'none' && after.position === 'absolute' && hit >= 44) continue;
      out.push(
        `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(r.height)}px`,
      );
    }
    return out;
  });
  expect(small, `${context}: targets under 44px\n${small.join('\n')}`).toEqual([]);
}

async function check(page: Page, context: string) {
  await axe(page, context);
  await targets(page, context);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('first run', async ({ app, page }) => {
  await app.open();
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome' })).toBeVisible();
  await check(page, 'first run');
});

test('Today, its sheets, and the rest timer', async ({ app, page }) => {
  await seedWithHistory(app);
  await page.goto('./#/today');
  const press = page.getByRole('article', { name: 'Chest press' });
  await expect(press).toBeVisible();
  await check(page, 'today');

  await press.getByRole('textbox', { name: 'Set 1 reps' }).fill('11');
  await press.getByRole('textbox', { name: 'Set 2 reps' }).fill('10');
  await press.getByRole('button', { name: /^Log/ }).click();
  await expect(page.getByRole('button', { name: /Rest timer/ })).toBeVisible();
  await check(page, 'today with a done card and the rest timer');

  await page.getByRole('button', { name: /^Notes for Incline press/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check(page, 'notes sheet');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^More for Incline press/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check(page, 'more sheet');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await check(page, 'finish confirmation');
});

test('Calendar and its day sheets', async ({ app, page }) => {
  await seedWithHistory(app);
  await page.goto('./#/calendar');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await check(page, 'calendar');
  await page
    .getByRole('region', { name: 'March 2026' })
    .getByRole('button', { name: /^Monday, March 9/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await check(page, 'past day sheet');
  await page.getByRole('dialog').getByRole('button').nth(1).click();
  await check(page, 'entry editor');
});

test('Progress', async ({ app, page }) => {
  await seedWithHistory(app);
  await page.goto('./#/progress');
  await expect(page.getByRole('region', { name: 'Exercise detail' })).toBeVisible();
  await check(page, 'progress');
});

test('Settings and its pages', async ({ app, page }) => {
  await seedWithHistory(app);
  for (const route of [
    'settings',
    'settings/cycle',
    'settings/workouts',
    'settings/exercises',
    'settings/exercises/new',
  ]) {
    await page.goto(`./#/${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await check(page, route);
  }
  await page.goto('./#/settings/exercises');
  await page.getByRole('button', { name: /^Chest press/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Chest press' })).toBeVisible();
  await check(page, 'exercise editor');
});

test('focus order follows the screen, top to bottom @desktop', async ({ app, page }) => {
  await app.seed();
  await expect(page.getByRole('article', { name: 'Chest press' })).toBeVisible();
  const positions: number[] = [];
  const names: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const outline = getComputedStyle(el).outlineStyle;
      return {
        top: r.top + window.scrollY,
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName,
        inMain: !!el.closest('main'),
        visibleFocus: outline !== 'none',
      };
    });
    if (!info || !info.inMain) continue;
    positions.push(info.top);
    names.push(info.name);
    expect(info.visibleFocus, `focus ring on ${info.name}`).toBe(true);
  }
  expect(names.slice(0, 3)).toEqual(['Notes for Chest press', 'More for Chest press', 'Machine']);
  // Within the main column, focus never jumps back up the page.
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i], `${names[i]} after ${names[i - 1]}`).toBeGreaterThanOrEqual(
      positions[i - 1] - 50,
    );
  }
});

test('reduced motion turns off sheet and card animations', async ({ app, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await app.seed();
  await page.getByRole('button', { name: /^More for Chest press/ }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('0s');
  await page.keyboard.press('Escape');
  const card = page.getByRole('article', { name: 'Chest press' });
  expect(await card.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
});
