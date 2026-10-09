// Builders for domain tests (also used by data/ and feature tests).
import type { CycleItem, Exercise, LogEntry, Session, SetLog, Unit } from './types';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const variantId = overrides.defaultVariantId ?? 'v-main';
  return {
    id: overrides.id ?? nextId('ex'),
    name: 'Chest press',
    type: 'upperCompound',
    muscleGroup: 'chest',
    sets: 2,
    repMin: 6,
    repMax: 12,
    restSeconds: 150,
    variants: [{ id: variantId, name: 'Machine', note: '', archived: false }],
    defaultVariantId: variantId,
    perSetWeight: false,
    archived: false,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? nextId('s'),
    date: '2026-03-02',
    workoutId: 'w-push',
    workoutName: 'Push',
    deload: false,
    status: 'finished',
    createdAt: 0,
    ...overrides,
  };
}

/** `reps` gives one set per number; `weight` applies to the whole entry. */
export function makeEntry(
  overrides: Partial<LogEntry> & {
    reps?: Array<number | null>;
    setWeights?: Array<number | null>;
  } = {},
): LogEntry {
  const { reps, setWeights, ...rest } = overrides;
  const sets: SetLog[] =
    rest.sets ??
    (reps ?? [10, 10]).map((r, i) => ({
      reps: r,
      weight: setWeights ? (setWeights[i] ?? null) : null,
    }));
  return {
    id: rest.id ?? nextId('e'),
    sessionId: 's-1',
    date: '2026-03-02',
    exerciseId: 'ex-1',
    variantId: 'v-main',
    unit: 'lb' as Unit,
    weight: 100,
    status: 'logged',
    swappedFromExerciseId: null,
    createdAt: 0,
    ...rest,
    sets,
  };
}

export const W = (workoutId: string): CycleItem => ({ kind: 'workout', workoutId });
export const REST: CycleItem = { kind: 'rest' };
