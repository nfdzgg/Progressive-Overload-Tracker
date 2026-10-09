// SPEC 5.3: reference entry, target, and prefill.
import { formatNumber } from './format';
import { displayWeight } from './units';
import type { Exercise, LogEntry, Session, Unit } from './types';

export type SessionLookup = Pick<Map<string, Session>, 'get'>;

/** Oldest first: by date, then creation time. */
export function sortChronologically<T extends Pick<LogEntry, 'date' | 'createdAt'>>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
  );
}

/**
 * Logged entries for an exercise + variant from non-deload sessions, oldest
 * first. Variant histories are never mixed.
 */
export function eligibleHistory(
  entries: LogEntry[],
  sessions: SessionLookup,
  exerciseId: string,
  variantId: string,
): LogEntry[] {
  return sortChronologically(
    entries.filter(
      (e) =>
        e.status === 'logged' &&
        e.exerciseId === exerciseId &&
        e.variantId === variantId &&
        sessions.get(e.sessionId)?.deload !== true,
    ),
  );
}

export interface ReferenceOptions {
  /** The session being logged; its own entry is never its reference. */
  excludeSessionId?: string;
}

/** The most recent logged entry for exercise + variant from a non-deload session. */
export function findReference(
  entries: LogEntry[],
  sessions: SessionLookup,
  exerciseId: string,
  variantId: string,
  options: ReferenceOptions = {},
): LogEntry | null {
  const history = eligibleHistory(entries, sessions, exerciseId, variantId).filter(
    (e) => e.sessionId !== options.excludeSessionId,
  );
  return history[history.length - 1] ?? null;
}

export type Target =
  | { kind: 'none' }
  | { kind: 'addWeight'; reference: LogEntry }
  | { kind: 'beat'; reference: LogEntry };

/**
 * No reference: nothing to show. Every set reached repMax: "Add weight".
 * Otherwise: "Beat" (same weight, one more rep on any set).
 */
export function computeTarget(reference: LogEntry | null, repMax: number): Target {
  if (!reference) return { kind: 'none' };
  const allAtMax =
    reference.sets.length > 0 && reference.sets.every((s) => s.reps !== null && s.reps >= repMax);
  return allAtMax ? { kind: 'addWeight', reference } : { kind: 'beat', reference };
}

export interface Prefill {
  /** Weight field value in the display unit ('' = empty / bodyweight). */
  weight: string;
  /** Per-set weight values, one per configured set (used when perSetWeight). */
  setWeights: string[];
  /** Reference reps shown as placeholders (never values); null = use the field label. */
  repPlaceholders: Array<string | null>;
}

/** The weight input is prefilled; rep inputs get the reference reps as placeholders. */
export function prefillFromReference(
  reference: LogEntry | null,
  exercise: Pick<Exercise, 'sets' | 'perSetWeight'>,
  displayUnit: Unit,
): Prefill {
  const show = (w: number | null) =>
    w === null || !reference ? '' : formatNumber(displayWeight(w, reference.unit, displayUnit));
  const sets = Array.from({ length: exercise.sets }, (_, i) => reference?.sets[i]);
  return {
    weight: show(reference?.weight ?? null),
    setWeights: sets.map((s) => (exercise.perSetWeight ? show(s?.weight ?? null) : '')),
    repPlaceholders: sets.map((s) => (s && s.reps !== null ? String(s.reps) : null)),
  };
}
