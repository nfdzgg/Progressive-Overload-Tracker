// SPEC 5.7: weekly numbers. Weeks start on Monday.
import { addDays, weekStart } from './dates';
import { MUSCLE_GROUPS } from './exerciseTypes';
import { performedSets, setWeight } from './e1rm';
import { convertWeight } from './units';
import type { Exercise, ISODate, LogEntry, MuscleGroup, Session, Unit } from './types';

function inWeek(date: ISODate, start: ISODate): boolean {
  return date >= start && date <= addDays(start, 6);
}

/**
 * Hard sets: logged sets with reps > 0, by the exercise's muscle group, for
 * the week starting `start`. Deload sessions count.
 */
export function hardSetsByMuscle(
  entries: LogEntry[],
  exercises: Pick<Map<string, Exercise>, 'get'>,
  start: ISODate,
): Record<MuscleGroup, number> {
  const counts = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;
  for (const entry of entries) {
    if (entry.status !== 'logged' || !inWeek(entry.date, start)) continue;
    const exercise = exercises.get(entry.exerciseId);
    if (!exercise) continue;
    counts[exercise.muscleGroup] += performedSets(entry).length;
  }
  return counts;
}

export function totalHardSets(counts: Record<MuscleGroup, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/** Sum of weight × reps over logged sets in the week (in `unit`); unweighted sets add 0. */
export function weeklyVolume(entries: LogEntry[], start: ISODate, unit: Unit): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.status !== 'logged' || !inWeek(entry.date, start)) continue;
    for (const set of performedSets(entry)) {
      const w = setWeight(entry, set);
      if (w !== null) total += convertWeight(w, entry.unit, unit) * set.reps!;
    }
  }
  return total;
}

/** Monday dates of the last `weeks` weeks, oldest first, ending with the current week. */
export function recentWeekStarts(today: ISODate, weeks: number): ISODate[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
}

/** Finished sessions per week for the last `weeks` weeks, oldest first. */
export function sessionsPerWeek(
  sessions: Session[],
  today: ISODate,
  weeks = 8,
): Array<{ weekStart: ISODate; count: number }> {
  return recentWeekStarts(today, weeks).map((start) => ({
    weekStart: start,
    count: sessions.filter((s) => s.status === 'finished' && inWeek(s.date, start)).length,
  }));
}

/**
 * Consecutive weeks with at least one finished session, ending with the
 * current week — or with last week while the current week has none yet.
 */
export function currentStreak(sessions: Session[], today: ISODate): number {
  const weeks = new Set(
    sessions.filter((s) => s.status === 'finished').map((s) => weekStart(s.date)),
  );
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}
