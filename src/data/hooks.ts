// Live queries: components re-render when the data changes, so edits in
// Settings take effect on Today without a reload. Each hook returns
// `undefined` while loading.
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DEFAULT_SETTINGS,
  emptyCycle,
  todayISO,
  type CycleState,
  type Exercise,
  type LogEntry,
  type Session,
  type Settings,
  type Workout,
} from '../domain';
import { db } from './db';

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get('settings');
    if (!row) return { ...DEFAULT_SETTINGS };
    const { id: _id, ...settings } = row;
    return settings;
  }, []);
}

export function useCycle(): CycleState | undefined {
  return useLiveQuery(async () => {
    const row = await db.cycle.get('cycle');
    if (!row) return emptyCycle(todayISO());
    const { id: _id, ...state } = row;
    return state;
  }, []);
}

/** All exercises including archived ones (history views need archived names). */
export function useAllExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.toArray(), []);
}

/** Active (non-archived) exercises, sorted by name: the library and pickers. */
export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    return all.filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name));
  }, []);
}

export function useExercise(id: string | undefined): Exercise | undefined {
  return useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
}

export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(() => db.workouts.toArray(), []);
}

export function useWorkout(id: string | undefined): Workout | undefined {
  return useLiveQuery(() => (id ? db.workouts.get(id) : undefined), [id]);
}

export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), []);
}

export function useSession(id: string | undefined | null): Session | undefined {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id]);
}

/** Every log entry (stats, history, references). */
export function useEntries(): LogEntry[] | undefined {
  return useLiveQuery(() => db.entries.toArray(), []);
}

export function useSessionEntries(sessionId: string | undefined | null): LogEntry[] | undefined {
  return useLiveQuery(
    () => (sessionId ? db.entries.where('sessionId').equals(sessionId).toArray() : []),
    [sessionId],
  );
}

/** Entries for one exercise + variant (history is per variant). */
export function useVariantEntries(
  exerciseId: string | undefined,
  variantId: string | undefined,
): LogEntry[] | undefined {
  return useLiveQuery(
    () =>
      exerciseId && variantId
        ? db.entries.where('[exerciseId+variantId]').equals([exerciseId, variantId]).toArray()
        : [],
    [exerciseId, variantId],
  );
}
