import { useSyncExternalStore } from 'react';

export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILD: string = __APP_BUILD__;

const LAST_BUILD_KEY = 'pot:last-build';

export interface PwaStatus {
  /** This launch runs a newer build than the previous launch (show "Updated"). */
  updated: boolean;
  /** A newer version has been downloaded; it applies on next launch. */
  updateWaiting: boolean;
  /** Everything is cached for offline use. */
  offlineReady: boolean;
}

function detectUpdated(): boolean {
  try {
    const previous = localStorage.getItem(LAST_BUILD_KEY);
    localStorage.setItem(LAST_BUILD_KEY, `${APP_VERSION}+${APP_BUILD}`);
    return previous !== null && previous !== `${APP_VERSION}+${APP_BUILD}`;
  } catch {
    return false;
  }
}

let status: PwaStatus = { updated: false, updateWaiting: false, offlineReady: false };
const listeners = new Set<() => void>();

function set(patch: Partial<PwaStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

/**
 * Registers the service worker. A new version installs in the background and
 * takes over on the next launch; nothing blocks or prompts.
 */
export async function startPwa(): Promise<void> {
  set({ updated: detectUpdated() });
  if (!('serviceWorker' in navigator) || import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return;
  }
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({
    immediate: true,
    onNeedRefresh: () => set({ updateWaiting: true }),
    onOfflineReady: () => set({ offlineReady: true }),
  });
}

export function usePwaStatus(): PwaStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
  );
}

/** URL of the bundled rest-timer sound (precached for offline use). */
export const REST_DONE_SOUND_URL = `${import.meta.env.BASE_URL}sounds/rest-done.wav`;
