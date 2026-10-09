import { describe, expect, it } from 'vitest';
import { formatDate, formatEntrySummary, formatNumber, formatRest, formatWeight } from './format';
import { makeEntry } from './test-helpers';

describe('format', () => {
  it('formats numbers without trailing zeros', () => {
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(62.5)).toBe('62.5');
    expect(formatNumber(2.25)).toBe('2.25');
    expect(formatNumber(1234.5678)).toBe('1234.57');
  });

  it('formats weights in the display unit, or BW for bodyweight', () => {
    expect(formatWeight(100, 'lb', 'lb')).toBe('100 lb');
    expect(formatWeight(100, 'kg', 'lb')).toBe('220.5 lb');
    expect(formatWeight(null, 'lb', 'lb')).toBe('BW');
  });

  it('summarizes an entry', () => {
    expect(formatEntrySummary(makeEntry({ weight: 100, reps: [10, 9] }), 'lb')).toBe(
      '100 lb × 10, 9',
    );
    expect(formatEntrySummary(makeEntry({ weight: null, reps: [15, 12] }), 'lb')).toBe(
      'BW × 15, 12',
    );
    expect(
      formatEntrySummary(makeEntry({ weight: null, reps: [12, 10], setWeights: [10, null] }), 'lb'),
    ).toBe('10 lb × 12, BW × 10');
    expect(formatEntrySummary(makeEntry({ weight: 50, unit: 'kg', reps: [8, null] }), 'lb')).toBe(
      '110 lb × 8',
    );
  });

  it('formats rest durations as m:ss', () => {
    expect(formatRest(150)).toBe('2:30');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(180)).toBe('3:00');
  });

  it('formats dates', () => {
    expect(formatDate('2026-03-02')).toBe('Mon, Mar 2');
    expect(formatDate('2026-03-02', 'long')).toBe('Monday, March 2, 2026');
  });
});
