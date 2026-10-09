import { useEffect } from 'react';
import { resolveCycleForToday } from '../data';
import type { ISODate } from '../domain';

/**
 * Applies the cycle's date rules (scheduled restart, rest-day consumption)
 * on app open and whenever the date changes.
 */
export function useDailyCycle(today: ISODate, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void resolveCycleForToday(today);
  }, [today, enabled]);
}
