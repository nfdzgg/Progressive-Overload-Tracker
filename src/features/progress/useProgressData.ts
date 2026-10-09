import { useMemo } from 'react';
import { useAllExercises, useEntries, useSessions, useSettings, useToday } from '../../data';
import type { ProgressData } from './progressModel';

/** Everything the dashboard reads, live; undefined while loading. */
export function useProgressData(): ProgressData | undefined {
  const entries = useEntries();
  const sessions = useSessions();
  const exercises = useAllExercises();
  const settings = useSettings();
  const today = useToday();
  const unit = settings?.unit;
  return useMemo(
    () =>
      entries && sessions && exercises && unit
        ? { entries, sessions, exercises, unit, today }
        : undefined,
    [entries, sessions, exercises, unit, today],
  );
}
