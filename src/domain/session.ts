// A session's "slots" are its workout's exercises. A slot is filled by the
// entry for that exercise, or by an entry swapped in for it for today.
import type { CycleState, LogEntry } from './types';

/** The entry that fills a workout slot (a swap counts for the slot it replaced). */
export function entryForSlot<T extends Pick<LogEntry, 'exerciseId' | 'swappedFromExerciseId'>>(
  entries: T[],
  slotExerciseId: string,
): T | undefined {
  return (
    entries.find((e) => e.swappedFromExerciseId === slotExerciseId) ??
    entries.find((e) => e.exerciseId === slotExerciseId && e.swappedFromExerciseId === null)
  );
}

/** Every slot is logged or skipped (and there is at least one slot). */
export function isSessionComplete(slotExerciseIds: string[], entries: LogEntry[]): boolean {
  if (slotExerciseIds.length === 0) return false;
  return slotExerciseIds.every((slot) => {
    const entry = entryForSlot(entries, slot);
    return entry?.status === 'logged' || entry?.status === 'skipped';
  });
}

/**
 * Drops a deleted workout's items from the cycle. The pointer stays on the
 * same item, or moves to the item that followed a removed one.
 */
export function removeWorkoutFromCycle(state: CycleState, workoutId: string): CycleState {
  const keep = (i: number) => {
    const item = state.items[i];
    return !(item.kind === 'workout' && item.workoutId === workoutId);
  };
  const items = state.items.filter((_, i) => keep(i));
  if (items.length === state.items.length) return state;
  let before = 0;
  for (let i = 0; i < state.pointer; i += 1) if (keep(i)) before += 1;
  return { ...state, items, pointer: before < items.length ? before : 0 };
}
