// SPEC 5.5: personal records per exercise + variant, non-deload sessions only,
// never on the first logged entry. Weights are compared in pounds.
import { entryE1rm, performedSets, setWeight } from './e1rm';
import { eligibleHistory, type SessionLookup } from './targets';
import { toLb } from './units';
import type { Exercise, ISODate, LogEntry, Unit } from './types';

export type PrKind = 'weight' | 'reps' | 'e1rm';

export const PR_KIND_LABELS: Record<PrKind, string> = {
  weight: 'Weight PR',
  reps: 'Rep PR',
  e1rm: 'e1RM PR',
};

const EPS = 1e-9;

/** Heaviest weight (lb) lifted for at least repMin reps; null if none. */
function qualifyingWeightLb(entry: LogEntry, repMin: number): number | null {
  const weights = performedSets(entry)
    .filter((s) => s.reps! >= repMin)
    .map((s) => setWeight(entry, s))
    .filter((w): w is number => w !== null)
    .map((w) => toLb(w, entry.unit));
  return weights.length ? Math.max(...weights) : null;
}

function setsLb(entry: LogEntry): Array<{ weightLb: number; reps: number }> {
  return performedSets(entry).map((s) => {
    const w = setWeight(entry, s);
    return { weightLb: w === null ? 0 : toLb(w, entry.unit), reps: s.reps! };
  });
}

function maxOf(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? Math.max(...present) : null;
}

/**
 * PR kinds earned by `entry` given the eligible earlier history (logged,
 * non-deload, same exercise + variant). A record needs an earlier value to
 * beat, so the first logged entry never earns one. Unweighted entries can
 * only earn the rep PR.
 */
export function prsForEntry(entry: LogEntry, previous: LogEntry[], repMin: number): PrKind[] {
  if (previous.length === 0) return [];
  const kinds: PrKind[] = [];

  const weight = qualifyingWeightLb(entry, repMin);
  const prevWeight = maxOf(previous.map((p) => qualifyingWeightLb(p, repMin)));
  if (weight !== null && prevWeight !== null && weight > prevWeight + EPS) kinds.push('weight');

  const prevSets = previous.flatMap(setsLb);
  const repPr = setsLb(entry).some(({ weightLb, reps }) => {
    const atOrAbove = prevSets.filter((p) => p.weightLb >= weightLb - EPS).map((p) => p.reps);
    return atOrAbove.length > 0 && reps > Math.max(...atOrAbove);
  });
  if (repPr) kinds.push('reps');

  const e1rm = entryE1rm(entry, 'lb');
  const prevE1rm = maxOf(previous.map((p) => entryE1rm(p, 'lb')));
  if (e1rm !== null && prevE1rm !== null && e1rm > prevE1rm + EPS) kinds.push('e1rm');

  return kinds;
}

export interface PrEvent {
  entryId: string;
  sessionId: string;
  exerciseId: string;
  variantId: string;
  date: ISODate;
  kind: PrKind;
  /** Unit the entry was typed in; `weight` and `e1rm` are in this unit. */
  unit: Unit;
  /** Weight PR: the weight; rep PR: weight of the record set (null = bodyweight). */
  weight: number | null;
  /** Rep PR: the record reps. */
  reps: number | null;
  /** e1RM PR: the estimate. */
  e1rm: number | null;
}

function eventFor(entry: LogEntry, kind: PrKind, repMin: number, previous: LogEntry[]): PrEvent {
  const base = {
    entryId: entry.id,
    sessionId: entry.sessionId,
    exerciseId: entry.exerciseId,
    variantId: entry.variantId,
    date: entry.date,
    kind,
    unit: entry.unit,
    weight: null as number | null,
    reps: null as number | null,
    e1rm: null as number | null,
  };
  const sets = performedSets(entry);
  if (kind === 'weight') {
    const qualifying = sets
      .filter((s) => s.reps! >= repMin)
      .map((s) => setWeight(entry, s))
      .filter((w): w is number => w !== null);
    return { ...base, weight: Math.max(...qualifying) };
  }
  if (kind === 'e1rm') return { ...base, e1rm: entryE1rm(entry, entry.unit) };
  // Rep PR: report the set that beat the most reps at its weight or heavier.
  const prevSets = previous.flatMap(setsLb);
  const record = sets.find((s) => {
    const w = setWeight(entry, s);
    const wLb = w === null ? 0 : toLb(w, entry.unit);
    const atOrAbove = prevSets.filter((p) => p.weightLb >= wLb - EPS).map((p) => p.reps);
    return atOrAbove.length > 0 && s.reps! > Math.max(...atOrAbove);
  });
  return { ...base, weight: record ? setWeight(entry, record) : null, reps: record?.reps ?? null };
}

/** Every PR across all exercise + variant histories, oldest first. */
export function computePrEvents(
  entries: LogEntry[],
  sessions: SessionLookup,
  exercises: Pick<Map<string, Exercise>, 'get'>,
): PrEvent[] {
  const pairs = new Map<string, { exerciseId: string; variantId: string }>();
  for (const e of entries) pairs.set(`${e.exerciseId}|${e.variantId}`, e);
  const events: PrEvent[] = [];
  for (const { exerciseId, variantId } of pairs.values()) {
    const exercise = exercises.get(exerciseId);
    if (!exercise) continue;
    const history = eligibleHistory(entries, sessions, exerciseId, variantId);
    history.forEach((entry, i) => {
      const previous = history.slice(0, i);
      for (const kind of prsForEntry(entry, previous, exercise.repMin)) {
        events.push(eventFor(entry, kind, exercise.repMin, previous));
      }
    });
  }
  return events.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

/** PR kinds for one entry against everything logged before it. */
export function prsForLoggedEntry(
  entry: LogEntry,
  entries: LogEntry[],
  sessions: SessionLookup,
  exercise: Pick<Exercise, 'repMin'>,
): PrKind[] {
  if (sessions.get(entry.sessionId)?.deload) return [];
  const history = eligibleHistory(entries, sessions, entry.exerciseId, entry.variantId).filter(
    (e) => e.id !== entry.id,
  );
  const previous = history.filter(
    (e) => e.date < entry.date || (e.date === entry.date && e.createdAt < entry.createdAt),
  );
  return prsForEntry(entry, previous, exercise.repMin);
}
