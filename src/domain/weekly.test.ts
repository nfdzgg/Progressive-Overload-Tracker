import { describe, expect, it } from 'vitest';
import { makeEntry, makeExercise, makeSession } from './test-helpers';
import {
  currentStreak,
  hardSetsByMuscle,
  sessionsPerWeek,
  totalHardSets,
  weeklyVolume,
} from './weekly';

const chest = makeExercise({ id: 'chest', muscleGroup: 'chest' });
const back = makeExercise({ id: 'back', muscleGroup: 'back' });
const exercises = new Map([chest, back].map((x) => [x.id, x]));

describe('hard sets per muscle group (5.7)', () => {
  it('counts logged sets with reps > 0 by muscle group within the Monday-based week', () => {
    const entries = [
      makeEntry({ exerciseId: 'chest', date: '2026-03-02', reps: [10, 9] }),
      makeEntry({ exerciseId: 'chest', date: '2026-03-08', reps: [10, 0] }),
      makeEntry({ exerciseId: 'back', date: '2026-03-04', reps: [10, null, 8] }),
      makeEntry({ exerciseId: 'back', date: '2026-03-09', reps: [10] }), // next week
      makeEntry({ exerciseId: 'back', date: '2026-03-01', reps: [10] }), // previous week
      makeEntry({ exerciseId: 'chest', date: '2026-03-03', reps: [10], status: 'draft' }),
      makeEntry({ exerciseId: 'chest', date: '2026-03-03', reps: [10], status: 'skipped' }),
    ];
    const sets = hardSetsByMuscle(entries, exercises, '2026-03-02');
    expect(sets.chest).toBe(3);
    expect(sets.back).toBe(2);
    expect(sets.quads).toBe(0);
    expect(totalHardSets(sets)).toBe(5);
  });

  it('deload sessions count', () => {
    // Hard sets do not look at sessions at all, so deload entries are included.
    const entries = [makeEntry({ exerciseId: 'chest', sessionId: 'deload', date: '2026-03-02' })];
    expect(hardSetsByMuscle(entries, exercises, '2026-03-02').chest).toBe(2);
  });
});

describe('volume (5.7)', () => {
  it('sums weight × reps over logged sets; unweighted sets contribute 0', () => {
    const entries = [
      makeEntry({ date: '2026-03-02', weight: 100, reps: [10, 8] }), // 1800
      makeEntry({ date: '2026-03-03', weight: null, reps: [20] }), // 0
      makeEntry({ date: '2026-03-04', weight: null, reps: [10, 10], setWeights: [20, null] }), // 200
      makeEntry({ date: '2026-03-04', weight: 500, reps: [10], status: 'draft' }),
    ];
    expect(weeklyVolume(entries, '2026-03-02', 'lb')).toBe(2000);
  });

  it('converts to the display unit', () => {
    const entries = [makeEntry({ date: '2026-03-02', weight: 100, unit: 'kg', reps: [10] })];
    expect(weeklyVolume(entries, '2026-03-02', 'lb')).toBeCloseTo(2204.6, 6);
  });
});

describe('consistency (5.7)', () => {
  const finished = (date: string) => makeSession({ date, status: 'finished' });

  it('counts finished sessions per week for the last 8 weeks, oldest first', () => {
    const sessions = [
      finished('2026-03-02'),
      finished('2026-03-04'),
      finished('2026-02-24'),
      makeSession({ date: '2026-03-05', status: 'inProgress' }),
      finished('2025-12-01'), // older than 8 weeks
    ];
    const weeks = sessionsPerWeek(sessions, '2026-03-05', 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ weekStart: '2026-03-02', count: 2 });
    expect(weeks[6]).toEqual({ weekStart: '2026-02-23', count: 1 });
    expect(weeks[0].weekStart).toBe('2026-01-12');
  });

  it('streak counts consecutive weeks with at least one finished session', () => {
    const sessions = [
      finished('2026-03-03'),
      finished('2026-02-24'),
      finished('2026-02-17'),
      finished('2026-02-03'),
    ];
    expect(currentStreak(sessions, '2026-03-05')).toBe(3);
  });

  it('an empty current week does not break the streak yet', () => {
    const sessions = [finished('2026-02-24'), finished('2026-02-17')];
    expect(currentStreak(sessions, '2026-03-05')).toBe(2);
  });

  it('streak is zero after a missed full week', () => {
    expect(currentStreak([finished('2026-02-17')], '2026-03-05')).toBe(0);
    expect(currentStreak([], '2026-03-05')).toBe(0);
  });
});
