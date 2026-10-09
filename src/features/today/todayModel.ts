// View-model helpers for the Today cards: what the inputs hold, what Log
// saves, and which slots a session has. The rules themselves (reference,
// target, prefill, PRs) come from src/domain.
import {
  displayWeight,
  entryForSlot,
  formatNumber,
  sortChronologically,
  type Exercise,
  type LogEntry,
  type Prefill,
  type SetLog,
  type Target,
  type Unit,
  type Variant,
  type Workout,
} from '../../domain';
import { parseNumberText } from '../../ui';

/** What a card's inputs hold (text, as typed). */
export interface CardForm {
  variantId: string;
  /** The one weight field (unused when the exercise has per-set weight). */
  weight: string;
  /** One weight per set (per-set weight only). */
  setWeights: string[];
  /** One reps field per set. */
  reps: string[];
}

export function activeVariants(exercise: Exercise): Variant[] {
  return exercise.variants.filter((v) => !v.archived);
}

/** The preferred variant while it is active, else the default, else the first active one. */
export function pickVariantId(exercise: Exercise, preferred?: string): string {
  const active = activeVariants(exercise);
  const isActive = (id: string | undefined): id is string =>
    id !== undefined && active.some((v) => v.id === id);
  if (isActive(preferred)) return preferred;
  if (isActive(exercise.defaultVariantId)) return exercise.defaultVariantId;
  return active[0]?.id ?? exercise.defaultVariantId;
}

/** Nothing typed yet (an entry created by a swap, or a reopened skip). */
export function isBlankEntry(entry: LogEntry): boolean {
  return entry.weight === null && entry.sets.every((s) => s.reps === null && s.weight === null);
}

function fit<T>(values: T[], length: number, fill: T): T[] {
  return Array.from({ length }, (_, i) => values[i] ?? fill);
}

function weightText(value: number | null, from: Unit, to: Unit): string {
  return value === null ? '' : formatNumber(displayWeight(value, from, to));
}

function formFromEntry(exercise: Exercise, entry: LogEntry, unit: Unit): CardForm {
  const sets = fit<SetLog>(entry.sets, exercise.sets, { reps: null, weight: null });
  return {
    variantId: pickVariantId(exercise, entry.variantId),
    weight: weightText(entry.weight, entry.unit, unit),
    setWeights: sets.map((s) =>
      exercise.perSetWeight ? weightText(s.weight ?? entry.weight, entry.unit, unit) : '',
    ),
    reps: sets.map((s) => (s.reps === null ? '' : String(s.reps))),
  };
}

function formFromPrefill(exercise: Exercise, variantId: string, prefill: Prefill): CardForm {
  return {
    variantId,
    weight: prefill.weight,
    setWeights: fit(prefill.setWeights, exercise.sets, ''),
    reps: fit<string>([], exercise.sets, ''),
  };
}

/**
 * The inputs until the card is edited here: an entry's typed values (a draft,
 * or a reopened logged entry), otherwise the prefill for the chosen variant.
 * Derived from live data, so it follows edits made elsewhere.
 */
export function untouchedForm(
  exercise: Exercise,
  entry: LogEntry | undefined,
  unit: Unit,
  prefillFor: (variantId: string) => Prefill,
): CardForm {
  if (entry && !isBlankEntry(entry)) return formFromEntry(exercise, entry, unit);
  const variantId = pickVariantId(exercise, entry?.variantId);
  return formFromPrefill(exercise, variantId, prefillFor(variantId));
}

/** Keeps one field per configured set (the set count can change in Settings). */
export function fitForm(form: CardForm, exercise: Exercise): CardForm {
  if (form.reps.length === exercise.sets && form.setWeights.length === exercise.sets) return form;
  return {
    ...form,
    setWeights: fit(form.setWeights, exercise.sets, ''),
    reps: fit(form.reps, exercise.sets, ''),
  };
}

/** Switching the chip swaps the prefilled weight to that variant; typed reps stay. */
export function withVariant(
  form: CardForm,
  exercise: Exercise,
  variantId: string,
  prefill: Prefill,
): CardForm {
  return {
    ...form,
    variantId,
    weight: prefill.weight,
    setWeights: exercise.perSetWeight
      ? fit(prefill.setWeights, exercise.sets, '')
      : form.setWeights,
  };
}

/** What gets saved: an empty weight is bodyweight (null). */
export function entryValues(
  form: CardForm,
  exercise: Exercise,
): { weight: number | null; sets: SetLog[] } {
  return {
    weight: exercise.perSetWeight ? null : parseNumberText(form.weight),
    sets: form.reps.map((reps, i) => ({
      reps: parseNumberText(reps),
      weight: exercise.perSetWeight ? parseNumberText(form.setWeights[i] ?? '') : null,
    })),
  };
}

/** Log requires at least one set with reps. */
export function canLog(form: CardForm): boolean {
  return form.reps.some((reps) => (parseNumberText(reps) ?? 0) > 0);
}

/** Reference reps as the placeholder, else the field label ("Set 2"). */
export function repPlaceholder(prefill: Prefill, index: number): string {
  return prefill.repPlaceholders[index] ?? `Set ${index + 1}`;
}

export function targetLabel(target: Target): string | null {
  if (target.kind === 'addWeight') return 'Add weight';
  if (target.kind === 'beat') return 'Beat: +1 rep';
  return null;
}

/** The slot an entry fills (a swapped entry fills the slot it replaced). */
function slotOf(entry: Pick<LogEntry, 'exerciseId' | 'swappedFromExerciseId'>): string {
  return entry.swappedFromExerciseId ?? entry.exerciseId;
}

/**
 * A session's cards: the workout's exercises that exist and are active, in
 * order. If the workout was deleted, the slots of the session's own entries.
 */
export function slotIds(
  workout: Workout | undefined,
  exercisesById: Pick<Map<string, Exercise>, 'get'>,
  sessionEntries: LogEntry[],
): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  if (workout) {
    for (const id of workout.exerciseIds) {
      const exercise = exercisesById.get(id);
      if (exercise && !exercise.archived) add(id);
    }
    return ids;
  }
  for (const entry of sortChronologically(sessionEntries)) {
    if (exercisesById.get(entry.exerciseId)) add(slotOf(entry));
  }
  return ids;
}

/** Slots that are neither logged nor skipped. */
export function pendingSlotCount(slots: string[], sessionEntries: LogEntry[]): number {
  return slots.filter((slot) => {
    const status = entryForSlot(sessionEntries, slot)?.status;
    return status !== 'logged' && status !== 'skipped';
  }).length;
}

/** A finished session's entries in workout order, then any others by time. */
export function finishedRows(workout: Workout | undefined, entries: LogEntry[]): LogEntry[] {
  const order = (entry: LogEntry) => {
    const index = workout ? workout.exerciseIds.indexOf(slotOf(entry)) : -1;
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  const chronological = sortChronologically(entries);
  return chronological
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => order(a.entry) - order(b.entry) || a.i - b.i)
    .map(({ entry }) => entry);
}
