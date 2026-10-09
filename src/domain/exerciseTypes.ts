import type { Exercise, ExerciseType, MuscleGroup } from './types';

export const EXERCISE_TYPES: ExerciseType[] = [
  'legCompound',
  'upperCompound',
  'largeIsolation',
  'smallIsolation',
];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  legCompound: 'Leg compound',
  upperCompound: 'Upper compound',
  largeIsolation: 'Large isolation',
  smallIsolation: 'Small isolation',
};

/** SPEC 4.1: defaults filled in when a type is chosen; both stay editable. */
export const TYPE_DEFAULTS: Record<
  ExerciseType,
  { repMin: number; repMax: number; restSeconds: number }
> = {
  legCompound: { repMin: 6, repMax: 12, restSeconds: 180 },
  upperCompound: { repMin: 6, repMax: 12, restSeconds: 150 },
  largeIsolation: { repMin: 10, repMax: 15, restSeconds: 120 },
  smallIsolation: { repMin: 10, repMax: 15, restSeconds: 90 },
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
};

export const DEFAULT_SETS = 2;
export const SETS_MIN = 1;
export const SETS_MAX = 10;
export const DEFAULT_VARIANT_NAME = 'Standard';

export function clampSets(sets: number): number {
  return Math.min(SETS_MAX, Math.max(SETS_MIN, Math.round(sets)));
}

export interface NewExerciseInput {
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;
  /** First name is the default variant; defaults to one "Standard" variant. */
  variantNames?: string[];
  sets?: number;
  perSetWeight?: boolean;
}

/** Builds an exercise with the type defaults (2 sets, rep range, rest). */
export function buildExercise(input: NewExerciseInput, newId: () => string): Exercise {
  const names = input.variantNames?.length ? input.variantNames : [DEFAULT_VARIANT_NAME];
  const variants = names.map((name) => ({ id: newId(), name, note: '', archived: false }));
  const defaults = TYPE_DEFAULTS[input.type];
  return {
    id: newId(),
    name: input.name,
    type: input.type,
    muscleGroup: input.muscleGroup,
    sets: clampSets(input.sets ?? DEFAULT_SETS),
    repMin: defaults.repMin,
    repMax: defaults.repMax,
    restSeconds: defaults.restSeconds,
    variants,
    defaultVariantId: variants[0].id,
    perSetWeight: input.perSetWeight ?? false,
    archived: false,
  };
}
