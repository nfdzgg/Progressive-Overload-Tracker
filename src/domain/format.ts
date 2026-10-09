// Text formatting shared by every screen, so numbers read the same everywhere.
import { parseISODate } from './dates';
import { setWeight } from './e1rm';
import { displayWeight } from './units';
import type { ISODate, LogEntry, Unit } from './types';

/** Up to two decimals, no trailing zeros. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** "100 lb", converted for display; "BW" for bodyweight. */
export function formatWeight(value: number | null, from: Unit, to: Unit): string {
  if (value === null) return 'BW';
  return `${formatNumber(displayWeight(value, from, to))} ${to}`;
}

/**
 * One line for an entry's numbers: "100 lb × 10, 9", "BW × 15, 12", or for
 * per-set weights "10 lb × 12, BW × 10". Sets without reps are left out.
 */
export function formatEntrySummary(entry: LogEntry, displayUnit: Unit): string {
  const sets = entry.sets.filter((s) => s.reps !== null && s.reps > 0);
  if (sets.length === 0) return '—';
  const perSet = sets.some((s) => s.weight !== null);
  if (!perSet) {
    return `${formatWeight(entry.weight, entry.unit, displayUnit)} × ${sets.map((s) => s.reps).join(', ')}`;
  }
  return sets
    .map((s) => `${formatWeight(setWeight(entry, s), entry.unit, displayUnit)} × ${s.reps}`)
    .join(', ');
}

/** Rest duration as m:ss. */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SHORT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const LONG = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/** "Mon, Mar 2" (short) or "Monday, March 2, 2026" (long). */
export function formatDate(date: ISODate, style: 'short' | 'long' = 'short'): string {
  return (style === 'long' ? LONG : SHORT).format(parseISODate(date));
}

/** "March 2026". */
export function formatMonth(year: number, month: number): string {
  return MONTH.format(new Date(year, month - 1, 1, 12));
}
