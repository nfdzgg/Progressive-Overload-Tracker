// SPEC section 7: the optional Push / Pull / Legs starter template.
import {
  buildExercise,
  type CycleItem,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
  type Workout,
} from '../domain';

interface SeedExercise {
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;
  variants: string[];
  perSetWeight?: boolean;
}

/** The table from section 7. The first variant listed is the default. */
export const SEED_EXERCISES: SeedExercise[] = [
  {
    name: 'Chest press',
    type: 'upperCompound',
    muscleGroup: 'chest',
    variants: ['Machine', 'Bench'],
  },
  { name: 'Incline press', type: 'upperCompound', muscleGroup: 'chest', variants: ['Bench'] },
  {
    name: 'Chest fly',
    type: 'largeIsolation',
    muscleGroup: 'chest',
    variants: ['Downstairs machine', 'Upstairs machine', 'Dumbbell on bench'],
  },
  {
    name: 'Lateral raise',
    type: 'smallIsolation',
    muscleGroup: 'shoulders',
    variants: ['Cable', 'Machine', 'Dumbbell'],
  },
  {
    name: 'Tricep overhead cable extension',
    type: 'smallIsolation',
    muscleGroup: 'triceps',
    variants: ['Cable'],
  },
  {
    name: 'Tricep pushdown',
    type: 'smallIsolation',
    muscleGroup: 'triceps',
    variants: ['Cable', 'Machine'],
  },
  {
    name: 'Lat pulldown',
    type: 'upperCompound',
    muscleGroup: 'back',
    variants: ['Wide grip', 'Short grip'],
  },
  { name: 'Row', type: 'upperCompound', muscleGroup: 'back', variants: ['Machine'] },
  {
    name: 'Rear delt fly',
    type: 'smallIsolation',
    muscleGroup: 'shoulders',
    variants: ['Machine', 'Cable'],
  },
  {
    name: 'Curl',
    type: 'smallIsolation',
    muscleGroup: 'biceps',
    variants: ['Preacher curl', 'Regular curl'],
  },
  { name: 'Hammer curl', type: 'smallIsolation', muscleGroup: 'biceps', variants: ['Dumbbell'] },
  {
    name: 'Leg press',
    type: 'legCompound',
    muscleGroup: 'quads',
    variants: ['Downstairs machine', 'Upstairs machine'],
  },
  { name: 'Romanian deadlift', type: 'legCompound', muscleGroup: 'hamstrings', variants: ['Bar'] },
  {
    name: 'Seated leg curl',
    type: 'largeIsolation',
    muscleGroup: 'hamstrings',
    variants: ['Downstairs machine', 'Upstairs machine'],
  },
  {
    name: 'Leg extension',
    type: 'largeIsolation',
    muscleGroup: 'quads',
    variants: ['Downstairs machine', 'Upstairs machine'],
  },
  {
    name: 'Incline bench crunch',
    type: 'smallIsolation',
    muscleGroup: 'abs',
    variants: ['Incline bench'],
    perSetWeight: true,
  },
];

export const SEED_WORKOUTS: Array<{ name: string; exercises: string[] }> = [
  {
    name: 'Push',
    exercises: [
      'Chest press',
      'Incline press',
      'Chest fly',
      'Lateral raise',
      'Tricep overhead cable extension',
      'Tricep pushdown',
    ],
  },
  {
    name: 'Pull',
    exercises: ['Lat pulldown', 'Row', 'Rear delt fly', 'Lateral raise', 'Curl', 'Hammer curl'],
  },
  {
    name: 'Legs',
    exercises: [
      'Leg press',
      'Romanian deadlift',
      'Seated leg curl',
      'Leg extension',
      'Incline bench crunch',
    ],
  },
];

/** Cycle: Push, Pull, Legs, Push, Pull, Legs, Rest. */
export const SEED_CYCLE = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'];

export interface Routine {
  exercises: Exercise[];
  workouts: Workout[];
  cycleItems: CycleItem[];
}

/** Builds the template with fresh ids. All exercises have 2 sets and type defaults. */
export function buildPplTemplate(newId: () => string): Routine {
  const exercises = SEED_EXERCISES.map((seed) =>
    buildExercise(
      {
        name: seed.name,
        type: seed.type,
        muscleGroup: seed.muscleGroup,
        variantNames: seed.variants,
        sets: 2,
        perSetWeight: seed.perSetWeight ?? false,
      },
      newId,
    ),
  );
  const byName = new Map(exercises.map((e) => [e.name, e.id]));
  const workouts = SEED_WORKOUTS.map((w) => ({
    id: newId(),
    name: w.name,
    exerciseIds: w.exercises.map((name) => byName.get(name)!),
  }));
  const workoutByName = new Map(workouts.map((w) => [w.name, w.id]));
  const cycleItems: CycleItem[] = SEED_CYCLE.map((name) =>
    name === 'Rest' ? { kind: 'rest' } : { kind: 'workout', workoutId: workoutByName.get(name)! },
  );
  return { exercises, workouts, cycleItems };
}
