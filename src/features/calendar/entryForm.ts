// The calendar's entry editor: what its inputs hold and what saving writes.
// Editing a past entry or logging one after the fact (SPEC 6.4).
import type { EntryPatch, PastEntryInput } from '../../data';
import {
  displayWeight,
  formatEntrySummary,
  formatNumber,
  type Exercise,
  type LogEntry,
  type SetLog,
  type Unit,
  type Variant,
} from '../../domain';
import { parseNumberText } from '../../ui';

/** The editor's inputs, as typed. */
export interface EntryForm {
  variantId: string;
  /** The one weight field (unused with per-set weight). */
  weight: string;
  /** One weight per set (per-set weight only). */
  setWeights: string[];
  /** One reps field per set. */
  reps: string[];
}

/** The active variants, plus the entry's own variant if it has since been archived. */
export function variantOptions(exercise: Exercise, currentVariantId?: string): Variant[] {
  return exercise.variants.filter((v) => !v.archived || v.id === currentVariantId);
}

/** Per-set weight fields: the exercise uses them, or the entry was typed that way. */
export function usesPerSetWeight(exercise: Exercise, entry?: LogEntry): boolean {
  return exercise.perSetWeight || (entry?.sets.some((s) => s.weight !== null) ?? false);
}

function weightText(value: number | null, from: Unit, to: Unit): string {
  return value === null ? '' : formatNumber(displayWeight(value, from, to));
}

function fit<T>(values: T[], length: number, fill: T): T[] {
  return Array.from({ length }, (_, i) => values[i] ?? fill);
}

/** An entry's numbers in the display unit; at least one field per configured set. */
export function formFromEntry(entry: LogEntry, exercise: Exercise, unit: Unit): EntryForm {
  const count = Math.max(entry.sets.length, exercise.sets);
  const sets = fit<SetLog>(entry.sets, count, { reps: null, weight: null });
  const perSet = usesPerSetWeight(exercise, entry);
  return {
    variantId: entry.variantId,
    weight: weightText(entry.weight, entry.unit, unit),
    setWeights: sets.map((s) =>
      perSet ? weightText(s.weight ?? entry.weight, entry.unit, unit) : '',
    ),
    reps: sets.map((s) => (s.reps === null ? '' : String(s.reps))),
  };
}

function defaultVariantId(exercise: Exercise): string {
  const active = exercise.variants.filter((v) => !v.archived);
  if (active.some((v) => v.id === exercise.defaultVariantId)) return exercise.defaultVariantId;
  return active[0]?.id ?? exercise.defaultVariantId;
}

/** Logging an exercise after the fact: the default variant, empty fields. */
export function blankForm(exercise: Exercise): EntryForm {
  return {
    variantId: defaultVariantId(exercise),
    weight: '',
    setWeights: fit<string>([], exercise.sets, ''),
    reps: fit<string>([], exercise.sets, ''),
  };
}

/** Like Log on Today: at least one set with reps. */
export function canSave(form: EntryForm): boolean {
  return form.reps.some((reps) => (parseNumberText(reps) ?? 0) > 0);
}

/** What the form says, in the display unit; an empty weight is bodyweight. */
function formValues(form: EntryForm, perSet: boolean): { weight: number | null; sets: SetLog[] } {
  return {
    weight: perSet ? null : parseNumberText(form.weight),
    sets: form.reps.map((reps, i) => ({
      reps: parseNumberText(reps),
      weight: perSet ? parseNumberText(form.setWeights[i] ?? '') : null,
    })),
  };
}

function sameWeights(a: EntryForm, b: EntryForm, perSet: boolean): boolean {
  if (!perSet) return a.weight === b.weight;
  return (
    a.setWeights.length === b.setWeights.length &&
    a.setWeights.every((w, i) => w === b.setWeights[i])
  );
}

/**
 * The update for an edited entry. Untouched weights keep the stored numbers
 * and unit (so a converted display value never rewrites them); otherwise the
 * weights are saved as shown, in the display unit. Saving logs the entry.
 */
export function entryPatch(
  entry: LogEntry,
  initial: EntryForm,
  form: EntryForm,
  perSet: boolean,
  unit: Unit,
): EntryPatch {
  const values = formValues(form, perSet);
  if (sameWeights(initial, form, perSet)) {
    return {
      variantId: form.variantId,
      unit: entry.unit,
      weight: perSet ? null : entry.weight,
      sets: values.sets.map((set, i) => ({
        reps: set.reps,
        weight: perSet ? (entry.sets[i]?.weight ?? entry.weight) : null,
      })),
      status: 'logged',
    };
  }
  return { variantId: form.variantId, unit, ...values, status: 'logged' };
}

/** A new logged entry for a past session. */
export function newEntryInput(
  sessionId: string,
  exercise: Exercise,
  form: EntryForm,
  perSet: boolean,
  unit: Unit,
): PastEntryInput {
  return {
    sessionId,
    exerciseId: exercise.id,
    variantId: form.variantId,
    unit,
    ...formValues(form, perSet),
  };
}

/** A row's secondary line: "Machine · 100 lb × 10, 9", "Skipped", or "Not logged". */
export function entryDetail(entry: LogEntry, exercise: Exercise | undefined, unit: Unit): string {
  if (entry.status === 'skipped') return 'Skipped';
  if (entry.status === 'draft') return 'Not logged';
  const summary = formatEntrySummary(entry, unit);
  const variant = exercise?.variants.find((v) => v.id === entry.variantId);
  return variant ? `${variant.name} · ${summary}` : summary;
}
