import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist';

function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (Object.prototype.hasOwnProperty.call(navigator, 'storage')) {
    delete (navigator as unknown as Record<string, unknown>).storage;
  }
});

describe('requestPersistentStorage', () => {
  it('asks the browser to keep the data', async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persist });
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the Storage API is unavailable', async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });

  it('does nothing when persist() is unavailable', async () => {
    setStorage({});
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });

  it('ignores a refusal or an error', async () => {
    setStorage({ persist: vi.fn(async () => false) });
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
    setStorage({
      persist: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });
});
