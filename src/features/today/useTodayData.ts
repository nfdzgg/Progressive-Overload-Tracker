import { useMemo } from 'react';
import {
  useAllExercises,
  useCycle,
  useEntries,
  useSessions,
  useSettings,
  useToday,
  useWorkouts,
} from '../../data';
import type { CycleState, Exercise, ISODate, LogEntry, Session, Unit, Workout } from '../../domain';

/** Everything Today reads, from live queries, so edits elsewhere show up without a reload. */
export interface TodayData {
  today: ISODate;
  /** Display unit; new entries are saved in it. */
  unit: Unit;
  cycle: CycleState;
  sessions: Session[];
  /** Every log entry (references and PRs need the whole history). */
  entries: LogEntry[];
  /** Includes archived exercises (a logged entry may point to one). */
  exercisesById: Map<string, Exercise>;
  workoutsById: Map<string, Workout>;
  sessionsById: Map<string, Session>;
}

/** Today's data, or undefined while the live queries load. */
export function useTodayData(): TodayData | undefined {
  const today = useToday();
  const settings = useSettings();
  const cycle = useCycle();
  const sessions = useSessions();
  const entries = useEntries();
  const exercises = useAllExercises();
  const workouts = useWorkouts();

  return useMemo(() => {
    if (!settings || !cycle || !sessions || !entries || !exercises || !workouts) return undefined;
    return {
      today,
      unit: settings.unit,
      cycle,
      sessions,
      entries,
      exercisesById: new Map(exercises.map((e) => [e.id, e])),
      workoutsById: new Map(workouts.map((w) => [w.id, w])),
      sessionsById: new Map(sessions.map((s) => [s.id, s])),
    };
  }, [today, settings, cycle, sessions, entries, exercises, workouts]);
}
