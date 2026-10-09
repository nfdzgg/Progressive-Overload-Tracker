import { describe, expect, it, vi } from 'vitest';
import { createRestTimerStore } from './restTimer';
import { createRestTimerStarter } from './startRestTimer';

const T0 = Date.UTC(2026, 2, 2, 9, 0, 0);

function setup(restTimerEnabled = true) {
  let now = T0;
  const store = createRestTimerStore({ now: () => now, storage: null });
  const alert = { prime: vi.fn(), fire: vi.fn(), isUnlocked: () => false };
  let settings = { restTimerEnabled };
  const start = createRestTimerStarter({
    store,
    alert,
    readSettings: () => Promise.resolve(settings),
  });
  return {
    store,
    alert,
    start,
    advance: (ms: number) => {
      now += ms;
    },
    setEnabled: (value: boolean) => {
      settings = { restTimerEnabled: value };
    },
  };
}

describe('starting the rest timer from Today events', () => {
  it('starts with the exercise rest, from the moment of the event', async () => {
    const { store, start, advance } = setup();
    const pending = start('Chest press', 150);
    advance(40); // reading settings takes a moment
    await pending;
    expect(store.getTimer()).toMatchObject({
      label: 'Chest press',
      endsAt: T0 + 150_000,
      durationMs: 150_000,
    });
  });

  it('primes the audio synchronously, inside the gesture', () => {
    const { alert, start } = setup();
    void start('Row', 150);
    expect(alert.prime).toHaveBeenCalledTimes(1);
  });

  it('never starts when the timer is turned off in Settings', async () => {
    const { store, start, setEnabled } = setup(false);
    await start('Row', 150);
    expect(store.getTimer()).toBeNull();
    setEnabled(true);
    await start('Row', 150);
    expect(store.getTimer()).not.toBeNull();
  });

  it('a new start replaces the running one', async () => {
    const { store, start, advance } = setup();
    await start('Chest press', 150);
    advance(30_000);
    await start('Lateral raise', 90);
    expect(store.getTimer()).toMatchObject({ label: 'Lateral raise', endsAt: T0 + 120_000 });
  });

  it('ignores a rest of zero', async () => {
    const { store, start } = setup();
    await start('Row', 0);
    expect(store.getTimer()).toBeNull();
  });

  it('does not throw when settings cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createRestTimerStore({ storage: null });
    const start = createRestTimerStarter({
      store,
      alert: { prime: vi.fn(), fire: vi.fn(), isUnlocked: () => false },
      readSettings: () => Promise.reject(new Error('db closed')),
    });
    await expect(start('Row', 90)).resolves.toBeUndefined();
    expect(store.getTimer()).toBeNull();
  });
});
