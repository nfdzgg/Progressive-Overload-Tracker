// SPEC 5.4: Epley estimated one-rep max from the best set of an entry.
import { convertWeight } from './units';
import type { LogEntry, SetLog, Unit } from './types';

export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Effective weight of a set: its own weight (per-set entries) or the entry weight. */
export function setWeight(entry: LogEntry, set: SetLog): number | null {
  const w = set.weight ?? entry.weight;
  return w !== null && w > 0 ? w : null;
}

/** Sets that were actually performed (reps > 0). */
export function performedSets(entry: LogEntry): SetLog[] {
  return entry.sets.filter((s) => s.reps !== null && s.reps > 0);
}

export function isWeightedEntry(entry: LogEntry): boolean {
  return performedSets(entry).some((s) => setWeight(entry, s) !== null);
}

export interface BestSet {
  /** In the requested unit; null for an unweighted set. */
  weight: number | null;
  reps: number;
  /** null when the entry has no weight. */
  e1rm: number | null;
}

/**
 * Best set of the entry: highest e1RM when weighted (weights converted to
 * `unit`), otherwise most reps.
 */
export function bestSet(entry: LogEntry, unit: Unit): BestSet | null {
  const sets = performedSets(entry);
  if (sets.length === 0) return null;
  let best: BestSet | null = null;
  for (const set of sets) {
    const raw = setWeight(entry, set);
    const weight = raw === null ? null : convertWeight(raw, entry.unit, unit);
    const candidate: BestSet = {
      weight,
      reps: set.reps!,
      e1rm: weight === null ? null : epley(weight, set.reps!),
    };
    if (!best) best = candidate;
    else if (candidate.e1rm !== null && (best.e1rm === null || candidate.e1rm > best.e1rm))
      best = candidate;
    else if (candidate.e1rm === null && best.e1rm === null && candidate.reps > best.reps)
      best = candidate;
  }
  return best;
}

/** e1RM of the entry in `unit`; null for entries with no weight. */
export function entryE1rm(entry: LogEntry, unit: Unit): number | null {
  return bestSet(entry, unit)?.e1rm ?? null;
}

/** Most reps in a single set; null if no set was performed. */
export function entryBestReps(entry: LogEntry): number | null {
  const reps = performedSets(entry).map((s) => s.reps!);
  return reps.length ? Math.max(...reps) : null;
}

/** Heaviest set weight of the entry in `unit` (top weight); null if unweighted. */
export function entryTopWeight(entry: LogEntry, unit: Unit): number | null {
  const weights = performedSets(entry)
    .map((s) => setWeight(entry, s))
    .filter((w): w is number => w !== null)
    .map((w) => convertWeight(w, entry.unit, unit));
  return weights.length ? Math.max(...weights) : null;
}
