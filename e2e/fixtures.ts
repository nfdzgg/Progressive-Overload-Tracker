// Shared Playwright fixtures. Slices import `test` and `expect` from here.
import { test as base, expect, type Page } from '@playwright/test';

type PotApi = Record<string, (...args: unknown[]) => unknown> & { ready?: boolean };

declare global {
  interface Window {
    __pot: PotApi;
  }
}

export class App {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Opens a route (e.g. "today", "settings") and waits for the test hooks. */
  async open(route = 'today'): Promise<void> {
    await this.page.goto(`./#/${route}`);
    await this.page.waitForFunction(() => window.__pot?.ready === true);
  }

  /**
   * Calls a data/domain function exported from src/data or src/domain in the
   * page, e.g. `app.call('completeFirstRun', 'template', 'lb', '2026-03-02')`.
   */
  async call<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(
      ([name, params]) => {
        const f = window.__pot[name as string];
        if (typeof f !== 'function')
          throw new Error(`window.__pot.${String(name)} is not a function`);
        return f(...(params as unknown[])) as unknown;
      },
      [fn, args] as const,
    ) as Promise<T>;
  }

  /** The page's local date (respects page.clock). */
  async today(): Promise<string> {
    return this.call<string>('todayISO');
  }

  /**
   * Skips first run: seeds the Push/Pull/Legs template (or a blank start)
   * and opens `route`.
   */
  async seed(
    options: { choice?: 'template' | 'blank'; unit?: 'lb' | 'kg'; route?: string } = {},
  ): Promise<void> {
    const { choice = 'template', unit = 'lb', route = 'today' } = options;
    await this.open(route);
    await this.call('completeFirstRun', choice, unit, await this.today());
    await this.page.goto(`./#/${route}`);
    await expect(this.page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  }

  /** Taps a bottom tab. */
  async tab(name: 'Today' | 'Calendar' | 'Progress' | 'Settings'): Promise<void> {
    await this.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('pot:test-hooks', '1'));
    await use(new App(page));
  },
});

export { expect };
