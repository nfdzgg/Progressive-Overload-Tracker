import { getSettings } from '../../data';
import type { Settings } from '../../domain';
import { restAlert, type RestAlert } from './restAlert';
import { restTimerStore, type RestTimerStore } from './restTimer';

export interface RestTimerStarterDeps {
  store: RestTimerStore;
  alert: RestAlert;
  readSettings: () => Promise<Pick<Settings, 'restTimerEnabled'>>;
}

/**
 * Returns `start(label, restSeconds)`, called when Today commits a set or
 * logs an entry. It unlocks audio while still inside the user's gesture, then
 * starts the timer (from the moment of the event) unless it is turned off in
 * Settings. A new start replaces the running one.
 */
export function createRestTimerStarter({ store, alert, readSettings }: RestTimerStarterDeps) {
  return async function start(label: string, restSeconds: number): Promise<void> {
    const startedAt = store.now();
    alert.prime();
    try {
      const settings = await readSettings();
      if (!settings.restTimerEnabled || !(restSeconds > 0)) return;
      store.start(label, restSeconds * 1000, startedAt);
    } catch (error) {
      console.error(error);
    }
  };
}

/** Starts the app's rest timer (see `createRestTimerStarter`). */
export const startRestTimer = createRestTimerStarter({
  store: restTimerStore,
  alert: restAlert,
  readSettings: getSettings,
});
