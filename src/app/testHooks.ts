import * as data from '../data';
import * as domain from '../domain';

const FLAG = 'pot:test-hooks';

/**
 * End-to-end tests set localStorage["pot:test-hooks"] = "1" before load to
 * get `window.__pot` (the data and domain modules) for seeding state. Inert
 * otherwise.
 */
export function installTestHooks(): void {
  try {
    if (localStorage.getItem(FLAG) !== '1') return;
  } catch {
    return;
  }
  (window as unknown as { __pot: unknown }).__pot = { ...domain, ...data, ready: true };
}
