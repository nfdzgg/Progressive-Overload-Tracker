import { describe, expect, it, vi } from 'vitest';
import {
  ALERT_GRACE_MS,
  STALE_AFTER_MS,
  TIMER_STORAGE_KEY,
  checkTimer,
  createRestTimerStore,
  isDone,
  parseTimer,
  remainingMs,
  serializeTimer,
  startTimer,
  type KeyValueStorage,
} from './restTimer';

const T0 = Date.UTC(2026, 2, 2, 9, 0, 0);

/** A clock the test moves by hand. */
function fakeClock(start = T0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return { storage, map };
}

describe('rest timer math (end timestamp)', () => {
  it('starts with an end timestamp duration ms after now', () => {
    expect(startTimer('Chest press', 150_000, T0)).toEqual({
      label: 'Chest press',
      endsAt: T0 + 150_000,
      durationMs: 150_000,
      alerted: false,
    });
  });

  it('remaining time is derived from the clock, never below zero', () => {
    const timer = startTimer('Row', 150_000, T0);
    expect(remainingMs(timer, T0)).toBe(150_000);
    expect(remainingMs(timer, T0 + 60_000)).toBe(90_000);
    expect(remainingMs(timer, T0 + 150_000)).toBe(0);
    expect(remainingMs(timer, T0 + 999_999)).toBe(0);
  });

  it('is done from the end timestamp on', () => {
    const timer = startTimer('Row', 90_000, T0);
    expect(isDone(timer, T0 + 89_999)).toBe(false);
    expect(isDone(timer, T0 + 90_000)).toBe(true);
  });

  it('a jump in time (backgrounded app, locked phone) gives the right remaining time', () => {
    const timer = startTimer('Leg press', 180_000, T0);
    // No ticks in between: the result depends only on the clock.
    expect(remainingMs(timer, T0 + 125_000)).toBe(55_000);
  });
});

describe('checkTimer (what reaching a moment means)', () => {
  const timer = startTimer('Row', 150_000, T0);

  it('is running before zero', () => {
    expect(checkTimer(timer, T0 + 10_000)).toBe('running');
  });

  it('alerts when zero is observed on time', () => {
    expect(checkTimer(timer, T0 + 150_000)).toBe('alert');
    expect(checkTimer(timer, T0 + 150_000 + ALERT_GRACE_MS)).toBe('alert');
  });

  it('is silent when zero passed while the app was hidden or suspended', () => {
    expect(checkTimer(timer, T0 + 150_000 + ALERT_GRACE_MS + 1)).toBe('silent');
  });

  it('is handled once the alert was played or skipped', () => {
    expect(checkTimer({ ...timer, alerted: true }, T0 + 150_000)).toBe('handled');
  });

  it('is stale long after zero', () => {
    expect(checkTimer({ ...timer, alerted: true }, T0 + 150_000 + STALE_AFTER_MS)).toBe('handled');
    expect(checkTimer({ ...timer, alerted: true }, T0 + 150_001 + STALE_AFTER_MS)).toBe('stale');
  });
});

describe('timer persistence format', () => {
  it('round-trips', () => {
    const timer = startTimer('Chest press', 150_000, T0);
    expect(parseTimer(serializeTimer(timer))).toEqual(timer);
  });

  it('rejects missing or malformed values', () => {
    expect(parseTimer(null)).toBeNull();
    expect(parseTimer('')).toBeNull();
    expect(parseTimer('{not json')).toBeNull();
    expect(parseTimer('null')).toBeNull();
    expect(parseTimer(JSON.stringify({ label: 'Row', endsAt: 'soon', durationMs: 1 }))).toBeNull();
    expect(parseTimer(JSON.stringify({ label: 'Row', endsAt: T0, durationMs: 0 }))).toBeNull();
    expect(parseTimer(JSON.stringify({ endsAt: T0, durationMs: 1000 }))).toBeNull();
  });

  it('accepts a value without the alerted flag (treated as not alerted)', () => {
    expect(parseTimer(JSON.stringify({ label: 'Row', endsAt: T0, durationMs: 1000 }))).toEqual({
      label: 'Row',
      endsAt: T0,
      durationMs: 1000,
      alerted: false,
    });
  });
});

describe('rest timer store', () => {
  it('starts, replaces, and dismisses', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    expect(store.getTimer()).toBeNull();

    store.start('Chest press', 150_000);
    expect(store.getTimer()).toMatchObject({ label: 'Chest press', endsAt: T0 + 150_000 });

    clock.advance(20_000);
    store.start('Incline press', 150_000);
    expect(store.getTimer()).toMatchObject({ label: 'Incline press', endsAt: T0 + 170_000 });

    store.dismiss();
    expect(store.getTimer()).toBeNull();
  });

  it('starts from a given moment (captured during the gesture)', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    clock.advance(500);
    store.start('Row', 90_000, T0);
    expect(store.getTimer()?.endsAt).toBe(T0 + 90_000);
  });

  it('ignores a start without a positive duration', () => {
    const store = createRestTimerStore({ now: fakeClock().now, storage: null });
    store.start('Row', 0);
    expect(store.getTimer()).toBeNull();
  });

  it('notifies subscribers on every change and keeps the snapshot stable otherwise', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.start('Row', 1_000);
    const snapshot = store.getTimer();
    expect(store.getTimer()).toBe(snapshot);
    expect(store.check()).toBe(false); // running: nothing changes
    expect(listener).toHaveBeenCalledTimes(1);
    store.dismiss();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.start('Row', 1_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('reports the alert exactly once when zero is reached, then stays at zero', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    store.start('Row', 90_000);
    clock.advance(89_000);
    expect(store.check()).toBe(false);
    clock.advance(1_000);
    expect(store.check()).toBe(true);
    expect(store.getTimer()).toMatchObject({ label: 'Row', alerted: true });
    clock.advance(30_000);
    expect(store.check()).toBe(false);
    expect(remainingMs(store.getTimer()!, clock.now())).toBe(0);
  });

  it('does not alert when zero passed while the app was hidden; shows zero instead', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    store.start('Row', 90_000);
    clock.advance(90_000 + ALERT_GRACE_MS + 5_000);
    expect(store.check()).toBe(false);
    expect(store.getTimer()).toMatchObject({ alerted: true });
  });

  it('clears a timer that finished long ago', () => {
    const clock = fakeClock();
    const store = createRestTimerStore({ now: clock.now, storage: null });
    store.start('Row', 90_000);
    clock.advance(90_000);
    store.check();
    clock.advance(STALE_AFTER_MS + 1);
    expect(store.check()).toBe(false);
    expect(store.getTimer()).toBeNull();
  });

  it('persists to storage and restores the remaining time after a relaunch', () => {
    const clock = fakeClock();
    const { storage, map } = memoryStorage();
    const store = createRestTimerStore({ now: clock.now, storage });
    store.start('Chest press', 150_000);
    expect(JSON.parse(map.get(TIMER_STORAGE_KEY)!)).toEqual({
      label: 'Chest press',
      endsAt: T0 + 150_000,
      durationMs: 150_000,
      alerted: false,
    });

    clock.advance(100_000);
    const relaunched = createRestTimerStore({ now: clock.now, storage });
    expect(relaunched.getTimer()).toMatchObject({ label: 'Chest press', durationMs: 150_000 });
    expect(remainingMs(relaunched.getTimer()!, clock.now())).toBe(50_000);

    relaunched.dismiss();
    expect(map.has(TIMER_STORAGE_KEY)).toBe(false);
  });

  it('a relaunch after zero shows zero without an alert', () => {
    const clock = fakeClock();
    const { storage } = memoryStorage();
    createRestTimerStore({ now: clock.now, storage }).start('Row', 90_000);
    clock.advance(95_000);
    const relaunched = createRestTimerStore({ now: clock.now, storage });
    expect(relaunched.getTimer()).toMatchObject({ label: 'Row', alerted: true });
    expect(relaunched.check()).toBe(false);
  });

  it('a relaunch long after zero drops the timer', () => {
    const clock = fakeClock();
    const { storage, map } = memoryStorage();
    createRestTimerStore({ now: clock.now, storage }).start('Row', 90_000);
    clock.advance(90_000 + STALE_AFTER_MS + 1);
    expect(createRestTimerStore({ now: clock.now, storage }).getTimer()).toBeNull();
    expect(map.has(TIMER_STORAGE_KEY)).toBe(false);
  });

  it('ignores corrupt stored values', () => {
    const { storage } = memoryStorage({ [TIMER_STORAGE_KEY]: '{oops' });
    expect(createRestTimerStore({ now: fakeClock().now, storage }).getTimer()).toBeNull();
  });

  it('keeps working when storage throws (private mode, blocked site data)', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createRestTimerStore({ now: fakeClock().now, storage: throwing });
    expect(store.getTimer()).toBeNull();
    store.start('Row', 90_000);
    expect(store.getTimer()).toMatchObject({ label: 'Row' });
    store.dismiss();
    expect(store.getTimer()).toBeNull();
  });
});
