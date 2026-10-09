import type { ISODate } from './types';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date of a Date, as YYYY-MM-DD. */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's local date. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/** Parses YYYY-MM-DD as local noon (noon avoids DST edge cases). */
export function parseISODate(date: ISODate): Date {
  const match = ISO.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO.exec(value);
  if (!match) return false;
  return toISODate(parseISODate(value)) === value;
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Negative when a is before b. ISO strings compare lexically. */
export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: ISODate): number {
  return (parseISODate(date).getDay() + 6) % 7;
}

/** Monday of the week containing date. */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, -dayOfWeek(date));
}

/** The coming Monday: strictly after date (a Monday gives the following Monday). */
export function nextMonday(date: ISODate): ISODate {
  return addDays(weekStart(date), 7);
}

/** First day of the month, `month` is 1–12. */
export function monthStart(year: number, month: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Last day of the month, `month` is 1–12. */
export function monthEnd(year: number, month: number): ISODate {
  return toISODate(new Date(year, month, 0, 12));
}

/** Monday-first weeks (7 dates each) covering the month; `month` is 1–12. */
export function monthMatrix(year: number, month: number): ISODate[][] {
  const first = monthStart(year, month);
  const last = monthEnd(year, month);
  const weeks: ISODate[][] = [];
  let cursor = weekStart(first);
  while (cursor <= last) {
    const week: ISODate[] = [];
    for (let i = 0; i < 7; i += 1) week.push(addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
