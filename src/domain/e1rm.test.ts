import { describe, expect, it } from 'vitest';
import { bestSet, entryBestReps, entryE1rm, epley, isWeightedEntry, setWeight } from './e1rm';
import { makeEntry } from './test-helpers';

describe('estimated 1RM (5.4)', () => {
  it('uses Epley: weight × (1 + reps / 30)', () => {
    expect(epley(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley(200, 1)).toBeCloseTo(206.667, 3);
  });

  it('uses the best set of the entry', () => {
    const entry = makeEntry({ weight: 100, reps: [8, 10, 6] });
    expect(bestSet(entry, 'lb')).toMatchObject({ reps: 10, weight: 100 });
    expect(entryE1rm(entry, 'lb')).toBeCloseTo(epley(100, 10), 6);
  });

  it('uses per-set weights when present', () => {
    const entry = makeEntry({ weight: null, reps: [10, 6], setWeights: [100, 130] });
    expect(setWeight(entry, entry.sets[1])).toBe(130);
    expect(entryE1rm(entry, 'lb')).toBeCloseTo(epley(130, 6), 6);
  });

  it('is undefined for entries with no weight; reps are used instead', () => {
    const entry = makeEntry({ weight: null, reps: [15, 18] });
    expect(isWeightedEntry(entry)).toBe(false);
    expect(entryE1rm(entry, 'lb')).toBeNull();
    expect(entryBestReps(entry)).toBe(18);
    expect(bestSet(entry, 'lb')).toMatchObject({ reps: 18, weight: null, e1rm: null });
  });

  it('converts units before comparing', () => {
    const kg = makeEntry({ weight: 100, unit: 'kg', reps: [10] });
    expect(entryE1rm(kg, 'lb')).toBeCloseTo(epley(220.46, 10), 6);
    expect(entryE1rm(kg, 'kg')).toBeCloseTo(epley(100, 10), 6);
  });

  it('ignores sets without reps', () => {
    const entry = makeEntry({ weight: 100, reps: [null, 0, 5] });
    expect(bestSet(entry, 'lb')?.reps).toBe(5);
    expect(bestSet(makeEntry({ reps: [null, null] }), 'lb')).toBeNull();
  });
});
