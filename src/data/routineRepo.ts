// Exercises (library) and workouts. SPEC 4.3: items with history are archived,
// never deleted; items with no history are removed outright.
import {
  buildExercise,
  clampSets,
  newId,
  removeWorkoutFromCycle,
  type Exercise,
  type ISODate,
  type NewExerciseInput,
  type Variant,
  type Workout,
} from '../domain';
import { getCycle, saveCycle } from './cycleRepo';
import { db } from './db';

export type RemoveResult = 'archived' | 'deleted';

// ---------- exercises ----------

export async function createExercise(input: NewExerciseInput): Promise<Exercise> {
  const exercise = buildExercise({ ...input, name: input.name.trim() }, newId);
  await db.exercises.add(exercise);
  return exercise;
}

export type ExercisePatch = Partial<
  Pick<
    Exercise,
    'name' | 'type' | 'muscleGroup' | 'sets' | 'repMin' | 'repMax' | 'restSeconds' | 'perSetWeight'
  >
>;

export async function updateExercise(id: string, patch: ExercisePatch): Promise<void> {
  const clean: ExercisePatch = { ...patch };
  if (clean.name !== undefined) clean.name = clean.name.trim();
  if (clean.sets !== undefined) clean.sets = clampSets(clean.sets);
  await db.exercises.update(id, clean);
}

/** An exercise has history when any logged entry was performed with it. */
export async function exerciseHasHistory(exerciseId: string): Promise<boolean> {
  const count = await db.entries
    .where('exerciseId')
    .equals(exerciseId)
    .filter((e) => e.status === 'logged')
    .count();
  return count > 0;
}

export async function variantHasHistory(exerciseId: string, variantId: string): Promise<boolean> {
  const count = await db.entries
    .where('[exerciseId+variantId]')
    .equals([exerciseId, variantId])
    .filter((e) => e.status === 'logged')
    .count();
  return count > 0;
}

/**
 * Removes an exercise from every workout. With history it is archived (history,
 * charts, and PRs remain); without history it is deleted along with any
 * unlogged drafts that reference it.
 */
export async function removeExercise(exerciseId: string): Promise<RemoveResult> {
  return db.transaction('rw', [db.exercises, db.workouts, db.entries], async () => {
    const workouts = await db.workouts.toArray();
    for (const w of workouts) {
      if (w.exerciseIds.includes(exerciseId)) {
        await db.workouts.update(w.id, {
          exerciseIds: w.exerciseIds.filter((id) => id !== exerciseId),
        });
      }
    }
    if (await exerciseHasHistory(exerciseId)) {
      await db.exercises.update(exerciseId, { archived: true });
      return 'archived';
    }
    await db.entries.where('exerciseId').equals(exerciseId).delete();
    await db.exercises.delete(exerciseId);
    return 'deleted';
  });
}

async function mutateVariants(
  exerciseId: string,
  fn: (exercise: Exercise) => Pick<Exercise, 'variants' | 'defaultVariantId'>,
): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) throw new Error('Exercise not found');
    await db.exercises.update(exerciseId, fn(exercise));
  });
}

export async function addVariant(exerciseId: string, name: string): Promise<Variant> {
  const variant: Variant = { id: newId(), name: name.trim(), note: '', archived: false };
  await mutateVariants(exerciseId, (e) => ({
    variants: [...e.variants, variant],
    defaultVariantId: e.defaultVariantId,
  }));
  return variant;
}

export function renameVariant(exerciseId: string, variantId: string, name: string): Promise<void> {
  return mutateVariants(exerciseId, (e) => ({
    variants: e.variants.map((v) => (v.id === variantId ? { ...v, name: name.trim() } : v)),
    defaultVariantId: e.defaultVariantId,
  }));
}

/** The note for a variant (seat height, pin setting). */
export function setVariantNote(exerciseId: string, variantId: string, note: string): Promise<void> {
  return mutateVariants(exerciseId, (e) => ({
    variants: e.variants.map((v) => (v.id === variantId ? { ...v, note } : v)),
    defaultVariantId: e.defaultVariantId,
  }));
}

/** Reorders variants; ids not listed keep their relative order at the end. */
export function reorderVariants(exerciseId: string, orderedIds: string[]): Promise<void> {
  return mutateVariants(exerciseId, (e) => {
    const listed = orderedIds
      .map((id) => e.variants.find((v) => v.id === id))
      .filter((v): v is Variant => !!v);
    const rest = e.variants.filter((v) => !orderedIds.includes(v.id));
    return { variants: [...listed, ...rest], defaultVariantId: e.defaultVariantId };
  });
}

export function setDefaultVariant(exerciseId: string, variantId: string): Promise<void> {
  return mutateVariants(exerciseId, (e) => {
    if (!e.variants.some((v) => v.id === variantId && !v.archived)) {
      throw new Error('Default variant must be an active variant');
    }
    return { variants: e.variants, defaultVariantId: variantId };
  });
}

/**
 * Archives a variant with history, or deletes one without. An exercise keeps
 * at least one active variant; if the default goes, the first remaining
 * active variant becomes the default.
 */
export async function removeVariant(exerciseId: string, variantId: string): Promise<RemoveResult> {
  return db.transaction('rw', [db.exercises, db.entries], async () => {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) throw new Error('Exercise not found');
    const active = exercise.variants.filter((v) => !v.archived);
    if (active.length <= 1 && active.some((v) => v.id === variantId)) {
      throw new Error('An exercise needs at least one variant');
    }
    const hasHistory = await variantHasHistory(exerciseId, variantId);
    const variants = hasHistory
      ? exercise.variants.map((v) => (v.id === variantId ? { ...v, archived: true } : v))
      : exercise.variants.filter((v) => v.id !== variantId);
    const defaultVariantId =
      exercise.defaultVariantId === variantId
        ? variants.find((v) => !v.archived)!.id
        : exercise.defaultVariantId;
    if (!hasHistory) {
      await db.entries.where('[exerciseId+variantId]').equals([exerciseId, variantId]).delete();
    }
    await db.exercises.update(exerciseId, { variants, defaultVariantId });
    return hasHistory ? 'archived' : 'deleted';
  });
}

// ---------- workouts ----------

export async function createWorkout(name: string, exerciseIds: string[] = []): Promise<Workout> {
  const workout: Workout = {
    id: newId(),
    name: name.trim(),
    exerciseIds: [...new Set(exerciseIds)],
  };
  await db.workouts.add(workout);
  return workout;
}

export async function renameWorkout(id: string, name: string): Promise<void> {
  await db.workouts.update(id, { name: name.trim() });
}

/** Sets the ordered exercise list (duplicates are dropped). */
export async function setWorkoutExercises(id: string, exerciseIds: string[]): Promise<void> {
  await db.workouts.update(id, { exerciseIds: [...new Set(exerciseIds)] });
}

/**
 * Deletes a workout and its cycle items. Past sessions keep their
 * `workoutName` snapshot, so history survives.
 */
export async function deleteWorkout(id: string, today: ISODate): Promise<void> {
  await db.transaction('rw', [db.workouts, db.cycle], async () => {
    await db.workouts.delete(id);
    const cycle = await getCycle(today);
    const next = removeWorkoutFromCycle(cycle, id);
    if (next !== cycle) await saveCycle(next);
  });
}
