import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  dayOfWeek,
  daysBetween,
  isISODate,
  maxDate,
  monthMatrix,
  nextMonday,
  toISODate,
  weekStart,
} from './dates';

describe('dates', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05');
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('validates ISO dates', () => {
    expect(isISODate('2026-03-05')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-3-5')).toBe(false);
    expect(isISODate('')).toBe(false);
  });

  it('adds days across month, year, and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('compares and diffs dates', () => {
    expect(compareDates('2026-03-01', '2026-03-02')).toBeLessThan(0);
    expect(compareDates('2026-03-02', '2026-03-02')).toBe(0);
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(maxDate('2026-03-01', '2026-02-01')).toBe('2026-03-01');
  });

  it('weeks start on Monday', () => {
    expect(dayOfWeek('2026-03-02')).toBe(0); // Monday
    expect(dayOfWeek('2026-03-08')).toBe(6); // Sunday
    expect(weekStart('2026-03-08')).toBe('2026-03-02');
    expect(weekStart('2026-03-02')).toBe('2026-03-02');
    expect(weekStart('2026-03-04')).toBe('2026-03-02');
  });

  it('next Monday is the coming Monday, never today', () => {
    expect(nextMonday('2026-03-04')).toBe('2026-03-09'); // Wednesday
    expect(nextMonday('2026-03-08')).toBe('2026-03-09'); // Sunday
    expect(nextMonday('2026-03-02')).toBe('2026-03-09'); // Monday -> next week
  });

  it('builds a Monday-first month matrix', () => {
    const weeks = monthMatrix(2026, 3);
    expect(weeks[0][0]).toBe('2026-02-23');
    expect(weeks[0][6]).toBe('2026-03-01');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[weeks.length - 1]).toContain('2026-03-31');
  });
});
