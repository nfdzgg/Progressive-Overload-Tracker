import { describe, expect, it } from 'vitest';
import {
  formatCompact,
  formatE1rm,
  formatVolume,
  plural,
  rangeStart,
  shortDate,
  weekLabel,
} from './progressFormat';

describe('progress formatting', () => {
  it('compact numbers for bar labels: whole below 1k, one decimal in thousands, then M', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(842.4)).toBe('842');
    expect(formatCompact(999.6)).toBe('1k');
    expect(formatCompact(1000)).toBe('1k');
    expect(formatCompact(12_449)).toBe('12.4k');
    expect(formatCompact(12_000)).toBe('12k');
    expect(formatCompact(124_600)).toBe('125k');
    expect(formatCompact(1_250_000)).toBe('1.3M');
  });

  it('volume with thousands separators and the unit', () => {
    expect(formatVolume(12_400.4, 'lb')).toBe('12,400 lb');
    expect(formatVolume(0, 'kg')).toBe('0 kg');
  });

  it('e1RM rounded to a whole number in the display unit', () => {
    expect(formatE1rm(133.333, 'lb')).toBe('133 lb');
    expect(formatE1rm(16.7, 'kg')).toBe('17 kg');
  });

  it('short dates and compact week labels', () => {
    expect(shortDate('2026-03-02')).toBe('Mar 2');
    expect(weekLabel('2026-03-02')).toBe('3/2');
    expect(weekLabel('2026-12-28')).toBe('12/28');
  });

  it('plural', () => {
    expect(plural(1, 'week', 'weeks')).toBe('1 week');
    expect(plural(0, 'week', 'weeks')).toBe('0 weeks');
    expect(plural(3, 'week', 'weeks')).toBe('3 weeks');
  });

  it('range start: calendar months back, clamped to the month end; All has none', () => {
    expect(rangeStart('2026-03-15', '1m')).toBe('2026-02-15');
    expect(rangeStart('2026-03-31', '1m')).toBe('2026-02-28');
    expect(rangeStart('2026-01-10', '1m')).toBe('2025-12-10');
    expect(rangeStart('2026-05-31', '3m')).toBe('2026-02-28');
    expect(rangeStart('2026-03-15', 'all')).toBeNull();
  });
});
