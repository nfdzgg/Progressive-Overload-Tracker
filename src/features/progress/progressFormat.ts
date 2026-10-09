// Presentational formatting for the Progress dashboard. No rules live here;
// the numbers come from src/domain.
import { monthEnd, parseISODate, type ISODate, type Unit } from '../../domain';

export type Range = '1m' | '3m' | 'all';

export const RANGE_OPTIONS: ReadonlyArray<{ value: Range; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'all', label: 'All' },
];

const RANGE_MONTHS: Record<Exclude<Range, 'all'>, number> = { '1m': 1, '3m': 3 };

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "Mar 2". */
export function shortDate(date: ISODate): string {
  return SHORT_DATE.format(parseISODate(date));
}

/** "3/2": fits under a narrow weekly bar. */
export function weekLabel(start: ISODate): string {
  const d = parseISODate(start);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Compact bar label: "842", "12.4k", "125k", "1.3M". */
export function formatCompact(value: number): string {
  const n = Math.round(value);
  if (n < 1000) return String(n);
  if (n < 100_000) return `${Math.round(n / 100) / 10}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${Math.round(n / 100_000) / 10}M`;
}

/** "12,400 lb". */
export function formatVolume(value: number, unit: Unit): string {
  return `${GROUPED.format(Math.round(value))} ${unit}`;
}

/** An estimate reads best as a whole number: "133 lb". `value` is already in `unit`. */
export function formatE1rm(value: number, unit: Unit): string {
  return `${Math.round(value)} ${unit}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** First date inside the range (calendar months back, clamped); null for All. */
export function rangeStart(today: ISODate, range: Range): ISODate | null {
  if (range === 'all') return null;
  const [y, m, d] = today.split('-').map(Number);
  const total = y * 12 + (m - 1) - RANGE_MONTHS[range];
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = Number(monthEnd(year, month).slice(8));
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
