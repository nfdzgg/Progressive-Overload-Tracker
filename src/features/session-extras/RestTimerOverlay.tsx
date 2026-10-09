import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Settings } from '../../domain';
import { RestTimerBar } from '../../ui';
import type { RestAlert } from './restAlert';
import { isDone, remainingMs, type RestTimerStore } from './restTimer';

/** How often the countdown is recomputed from the end timestamp. */
export const TICK_MS = 250;

/** Events that count as a user gesture for unlocking audio. */
const GESTURES = ['click', 'touchend', 'keydown'] as const;

export interface RestTimerOverlayProps {
  store: RestTimerStore;
  alert: RestAlert;
  /** Timer preferences; undefined while loading (defaults apply). */
  settings: Pick<Settings, 'restTimerEnabled' | 'restTimerSound'> | undefined;
}

/**
 * The compact rest timer bar (SPEC 6.3), shown by the shell above the tab bar
 * on every tab. The countdown is recomputed from the end timestamp on a short
 * interval and whenever the app returns to the foreground. At zero it alerts
 * once and stays at 0:00 until tapped away or replaced.
 */
export function RestTimerOverlay({ store, alert, settings }: RestTimerOverlayProps) {
  const timer = useSyncExternalStore(store.subscribe, store.getTimer, store.getTimer);
  const [now, setNow] = useState(() => store.now());
  const enabled = settings?.restTimerEnabled ?? true;
  const sound = useRef(settings?.restTimerSound ?? true);
  useEffect(() => {
    sound.current = settings?.restTimerSound ?? true;
  });

  // Turning the timer off in Settings removes a running one.
  useEffect(() => {
    if (!enabled) store.dismiss();
  }, [enabled, store]);

  // iOS plays audio only from an element started during a gesture: unlock it on any tap.
  useEffect(() => {
    const unlock = () => alert.prime();
    for (const type of GESTURES) document.addEventListener(type, unlock, true);
    return () => {
      for (const type of GESTURES) document.removeEventListener(type, unlock, true);
    };
  }, [alert]);

  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      if (store.check()) alert.fire(sound.current);
      setNow(store.now());
    };
    tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Once zero is handled the bar is static; only a return to the app needs a check.
    const settled = timer.alerted && isDone(timer, store.now());
    const interval = settled ? undefined : window.setInterval(tick, TICK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [timer, store, alert]);

  if (!timer || !enabled) return null;
  return (
    <RestTimerBar
      label={timer.label}
      // `now` may predate a timer that just started; never show more than its length.
      remainingMs={Math.min(timer.durationMs, remainingMs(timer, now))}
      totalMs={timer.durationMs}
      onDismiss={store.dismiss}
    />
  );
}
