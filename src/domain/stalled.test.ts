import { describe, expect, it } from 'vitest';
import { findStalled, isStalled } from './stalled';
import { makeEntry, makeSession } from './test-helpers';

const e = (weight: number | null, reps: number[], date = '2026-03-01') =>
  makeEntry({ weight, reps, date });

describe('stalled (5.6)', () => {
  it('needs at least four non-deload entries', () => {
    expect(isStalled([e(100, [10]), e(100, [10]), e(100, [10])], 'lb')).toBe(false);
  });

  it('is stalled when none of the latest three beat the best e1RM before them', () => {
    expect(isStalled([e(100, [10]), e(100, [10]), e(100, [9]), e(100, [10])], 'lb')).toBe(true);
  });

  it('is not stalled when one of the latest three beats it', () => {
    expect(isStalled([e(100, [10]), e(100, [10]), e(100, [11]), e(100, [9])], 'lb')).toBe(false);
  });

  it('uses best reps for unweighted entries', () => {
    expect(isStalled([e(null, [20]), e(null, [18]), e(null, [20]), e(null, [19])], 'lb')).toBe(
      true,
    );
    expect(isStalled([e(null, [20]), e(null, [18]), e(null, [21]), e(null, [19])], 'lb')).toBe(
      false,
    );
  });

  it('finds stalled exercise + variant pairs, ignoring deload sessions and drafts', () => {
    const sessions = [1, 2, 3, 4, 5].map((n) =>
      makeSession({ id: `s${n}`, date: `2026-03-0${n}`, deload: n === 5 }),
    );
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const entries = [
      makeEntry({ sessionId: 's1', date: '2026-03-01', reps: [10] }),
      makeEntry({ sessionId: 's2', date: '2026-03-02', reps: [9] }),
      makeEntry({ sessionId: 's3', date: '2026-03-03', reps: [9] }),
      makeEntry({ sessionId: 's4', date: '2026-03-04', reps: [10] }),
      // Deload entry with a big number does not un-stall it.
      makeEntry({ sessionId: 's5', date: '2026-03-05', reps: [20] }),
      makeEntry({ sessionId: 's4', date: '2026-03-04', reps: [30], status: 'draft' }),
    ];
    expect(findStalled(entries, byId, 'lb')).toEqual([{ exerciseId: 'ex-1', variantId: 'v-main' }]);
  });
});
