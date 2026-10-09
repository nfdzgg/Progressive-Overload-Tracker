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

/** Everything the Calendar reads, from live queries (edits show up without a reload). */
export interface CalendarData {
  today: ISODate;
  /** Display unit; entries typed here are saved in it. */
  unit: Unit;
  cycle: CycleState;
  sessions: Session[];
  entries: LogEntry[];
  /** Includes archived exercises (past entries may point to one). */
  exercisesById: Map<string, Exercise>;
  workouts: Workout[];
  workoutsById: Map<string, Workout>;
}

/** The Calendar's data, or undefined while the live queries load. */
export function useCalendarData(): CalendarData | undefined {
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
      workouts,
      workoutsById: new Map(workouts.map((w) => [w.id, w])),
    };
  }, [today, settings, cycle, sessions, entries, exercises, workouts]);
}
