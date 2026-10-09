// SPEC 5.6: an exercise + variant is stalled when it has at least four
// non-deload entries and none of the latest three beat the best e1RM (or best
// reps when unweighted) recorded before them.
import { entryBestReps, entryE1rm, isWeightedEntry } from './e1rm';
import { eligibleHistory, type SessionLookup } from './targets';
import type { LogEntry, Unit } from './types';

/** `history`: logged, non-deload entries for one exercise + variant, oldest first. */
export function isStalled(history: LogEntry[], unit: Unit): boolean {
  if (history.length < 4) return false;
  const weighted = history.some(isWeightedEntry);
  const metric = (e: LogEntry) => (weighted ? entryE1rm(e, unit) : entryBestReps(e));
  const before = history
    .slice(0, -3)
    .map(metric)
    .filter((v): v is number => v !== null);
  if (before.length === 0) return false;
  const best = Math.max(...before);
  return history.slice(-3).every((e) => {
    const value = metric(e);
    return value === null || value <= best + 1e-9;
  });
}

export interface VariantRef {
  exerciseId: string;
  variantId: string;
}

/** All stalled exercise + variant pairs. */
export function findStalled(
  entries: LogEntry[],
  sessions: SessionLookup,
  unit: Unit,
): VariantRef[] {
  const pairs = new Map<string, VariantRef>();
  for (const e of entries) {
    if (e.status === 'logged') pairs.set(`${e.exerciseId}|${e.variantId}`, e);
  }
  return [...pairs.values()]
    .filter(({ exerciseId, variantId }) =>
      isStalled(eligibleHistory(entries, sessions, exerciseId, variantId), unit),
    )
    .map(({ exerciseId, variantId }) => ({ exerciseId, variantId }));
}
