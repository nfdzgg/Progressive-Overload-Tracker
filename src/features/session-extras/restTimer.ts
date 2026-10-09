// Rest timer state (SPEC 6.3). The timer is an end timestamp, never a
// decrementing counter, so it stays right after the app is backgrounded, the
// phone is locked, or the app is relaunched (it is persisted to storage).

export interface RestTimer {
  /** Exercise name shown on the bar. */
  label: string;
  /** Epoch ms at which the rest is over. */
  endsAt: number;
  /** Full rest length, for the progress line. */
  durationMs: number;
  /** Zero has been handled: the alert played, or was skipped because zero passed unseen. */
  alerted: boolean;
}

export const TIMER_STORAGE_KEY = 'pot:rest-timer';

/** Zero must be observed within this window for the sound to play. */
export const ALERT_GRACE_MS = 3_000;

/** A finished timer this long past zero is dropped (an old timer from an earlier workout). */
export const STALE_AFTER_MS = 60 * 60_000;

export function startTimer(label: string, durationMs: number, now: number): RestTimer {
  return { label, endsAt: now + durationMs, durationMs, alerted: false };
}

export function remainingMs(timer: RestTimer, now: number): number {
  return Math.max(0, timer.endsAt - now);
}

export function isDone(timer: RestTimer, now: number): boolean {
  return now >= timer.endsAt;
}

/**
 * What the moment `now` means for the timer:
 * - `running`: before zero.
 * - `alert`: zero was reached just now; play the sound and vibrate.
 * - `silent`: zero passed while the app was hidden or suspended; show 0:00, no sound.
 * - `handled`: zero was already dealt with; it stays at 0:00.
 * - `stale`: zero passed long ago; drop the timer.
 */
export type TimerCheck = 'running' | 'alert' | 'silent' | 'handled' | 'stale';

export function checkTimer(timer: RestTimer, now: number): TimerCheck {
  if (now < timer.endsAt) return 'running';
  const late = now - timer.endsAt;
  if (late > STALE_AFTER_MS) return 'stale';
  if (timer.alerted) return 'handled';
  return late <= ALERT_GRACE_MS ? 'alert' : 'silent';
}

export function serializeTimer(timer: RestTimer): string {
  return JSON.stringify(timer);
}

/** A stored timer, or null when missing or malformed. */
export function parseTimer(text: string | null | undefined): RestTimer | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { label, endsAt, durationMs, alerted } = value as Record<string, unknown>;
  if (typeof label !== 'string') return null;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return null;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  return { label, endsAt, durationMs, alerted: alerted === true };
}

// ---------- store ----------

/** The part of `localStorage` the store needs (injectable for tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RestTimerStore {
  /** The current timer, or null (stable reference until it changes). */
  getTimer(): RestTimer | null;
  /** The store's clock. */
  now(): number;
  /** Starts a timer, replacing any running one. `startedAt` defaults to now. */
  start(label: string, durationMs: number, startedAt?: number): void;
  dismiss(): void;
  /**
   * Checks the timer against the clock (on every tick and when the app
   * returns to the foreground). Marks zero as handled and drops a stale
   * timer. Returns true exactly once, when the alert should play.
   */
  check(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface RestTimerStoreOptions {
  now?: () => number;
  /** null keeps the timer in memory only. */
  storage?: KeyValueStorage | null;
}

/** `window.localStorage`, or null where it cannot be reached. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createRestTimerStore(options: RestTimerStoreOptions = {}): RestTimerStore {
  // Read at call time, so fake clocks installed later are honored.
  const now = options.now ?? (() => Date.now());
  const storage = options.storage ?? null;
  const listeners = new Set<() => void>();

  function load(): RestTimer | null {
    try {
      return parseTimer(storage?.getItem(TIMER_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function save(next: RestTimer | null) {
    if (!storage) return;
    try {
      if (next) storage.setItem(TIMER_STORAGE_KEY, serializeTimer(next));
      else storage.removeItem(TIMER_STORAGE_KEY);
    } catch {
      // Storage unavailable: the timer still works for this launch.
    }
  }

  let timer: RestTimer | null = null;

  function set(next: RestTimer | null) {
    timer = next;
    save(next);
    for (const listener of listeners) listener();
  }

  /** Applies a check; returns true when the alert should play. */
  function reconcile(allowAlert: boolean): boolean {
    if (!timer) return false;
    const result = checkTimer(timer, now());
    if (result === 'stale') {
      set(null);
      return false;
    }
    if (result === 'alert' || result === 'silent') {
      set({ ...timer, alerted: true });
      return result === 'alert' && allowAlert;
    }
    return false;
  }

  // A relaunch restores the timer; zero that passed meanwhile is never alerted.
  timer = load();
  reconcile(false);

  return {
    getTimer: () => timer,
    now,
    start(label, durationMs, startedAt = now()) {
      if (!(durationMs > 0)) return;
      set(startTimer(label, durationMs, startedAt));
    },
    dismiss() {
      if (timer) set(null);
    },
    check: () => reconcile(true),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's rest timer, persisted in localStorage. */
export const restTimerStore: RestTimerStore = createRestTimerStore({
  storage: browserStorage(),
});
