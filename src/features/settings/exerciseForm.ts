// Form state, defaults, and validation for creating and editing a library
// exercise. Numbers the user types (rep range) are kept as text so a field can
// be empty or briefly invalid while typing; sets and rest come from pickers.
import type { ExercisePatch } from '../../data';
import {
  clampSets,
  DEFAULT_SETS,
  formatRest,
  MUSCLE_GROUP_LABELS,
  TYPE_DEFAULTS,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
  type NewExerciseInput,
  type Variant,
} from '../../domain';

export interface ExerciseForm {
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;
  sets: number;
  repMin: string;
  repMax: string;
  restSeconds: number;
  perSetWeight: boolean;
}

export interface ExerciseFormErrors {
  name?: string;
  repMin?: string;
  repMax?: string;
}

export const REPS_LIMIT = 100;
export const NEW_EXERCISE_TYPE: ExerciseType = 'upperCompound';
export const NEW_EXERCISE_MUSCLE: MuscleGroup = 'chest';

const REST_STEP = 30;
const REST_MAX = 300;

function typeDefaults(type: ExerciseType) {
  const d = TYPE_DEFAULTS[type];
  return { repMin: String(d.repMin), repMax: String(d.repMax), restSeconds: d.restSeconds };
}

/** A blank exercise: 2 sets and the rep range and rest of its type (SPEC 4.1). */
export function newExerciseForm(type: ExerciseType = NEW_EXERCISE_TYPE): ExerciseForm {
  return {
    name: '',
    type,
    muscleGroup: NEW_EXERCISE_MUSCLE,
    sets: DEFAULT_SETS,
    ...typeDefaults(type),
    perSetWeight: false,
  };
}

/**
 * Sets the type. When creating an exercise (`fillDefaults`), choosing a type
 * fills in its rep range and rest; both stay editable. Editing an existing
 * exercise keeps its values.
 */
export function withType(
  form: ExerciseForm,
  type: ExerciseType,
  fillDefaults: boolean,
): ExerciseForm {
  return fillDefaults ? { ...form, type, ...typeDefaults(type) } : { ...form, type };
}

export function formFromExercise(e: Exercise): ExerciseForm {
  return {
    name: e.name,
    type: e.type,
    muscleGroup: e.muscleGroup,
    sets: e.sets,
    repMin: String(e.repMin),
    repMax: String(e.repMax),
    restSeconds: e.restSeconds,
    perSetWeight: e.perSetWeight,
  };
}

/** A rep count: a whole number from 1 to 100, else null. */
export function parseReps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= REPS_LIMIT ? value : null;
}

export function validateName(name: string): string | undefined {
  return name.trim() === '' ? 'Enter a name' : undefined;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * `takenNames` are the other active exercises' names: names must be unique
 * because a routine import matches exercises by name.
 */
export function validateExerciseForm(
  form: ExerciseForm,
  takenNames: readonly string[],
): ExerciseFormErrors {
  const errors: ExerciseFormErrors = {};
  const nameError = validateName(form.name);
  if (nameError) errors.name = nameError;
  else if (takenNames.some((n) => sameName(n, form.name))) {
    errors.name = 'An exercise with this name already exists';
  }
  const min = parseReps(form.repMin);
  const max = parseReps(form.repMax);
  if (min === null) errors.repMin = `1 to ${REPS_LIMIT}`;
  if (max === null) errors.repMax = `1 to ${REPS_LIMIT}`;
  if (min !== null && max !== null && min > max) errors.repMax = "Max can't be below min";
  return errors;
}

export function hasErrors(errors: ExerciseFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The valid parts of the form as an update; an invalid name or rep range is left out. */
export function exercisePatch(form: ExerciseForm, errors: ExerciseFormErrors): ExercisePatch {
  const patch: ExercisePatch = {
    type: form.type,
    muscleGroup: form.muscleGroup,
    sets: clampSets(form.sets),
    restSeconds: form.restSeconds,
    perSetWeight: form.perSetWeight,
  };
  if (!errors.name) patch.name = form.name.trim();
  if (!errors.repMin && !errors.repMax) {
    patch.repMin = parseReps(form.repMin)!;
    patch.repMax = parseReps(form.repMax)!;
  }
  return patch;
}

/** Input for `createExercise`; an empty variant name gives the default "Standard". */
export function newExerciseInput(form: ExerciseForm, variantName: string): NewExerciseInput {
  const input: NewExerciseInput = {
    name: form.name.trim(),
    type: form.type,
    muscleGroup: form.muscleGroup,
    sets: clampSets(form.sets),
    perSetWeight: form.perSetWeight,
  };
  if (variantName.trim()) input.variantNames = [variantName.trim()];
  return input;
}

/** Rest choices in 30-second steps up to 5:00, plus the current value if it is off-step. */
export function restOptions(current: number): Array<{ value: string; label: string }> {
  const values = new Set<number>();
  for (let s = REST_STEP; s <= REST_MAX; s += REST_STEP) values.add(s);
  values.add(current);
  return [...values].sort((a, b) => a - b).map((s) => ({ value: String(s), label: formatRest(s) }));
}

/** "Chest · 2 × 6–12 · 2:30 rest" for library rows; without rest for narrower rows. */
export function exerciseSummary(e: Exercise, withRest = true): string {
  const base = `${MUSCLE_GROUP_LABELS[e.muscleGroup]} · ${e.sets} × ${e.repMin}–${e.repMax}`;
  return withRest ? `${base} · ${formatRest(e.restSeconds)} rest` : base;
}

export function validateVariantName(
  name: string,
  variants: readonly Variant[],
  exceptId?: string,
): string | undefined {
  const empty = validateName(name);
  if (empty) return empty;
  const taken = variants.some((v) => !v.archived && v.id !== exceptId && sameName(v.name, name));
  return taken ? 'This exercise already has that variant' : undefined;
}
