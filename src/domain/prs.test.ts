import { describe, expect, it } from 'vitest';
import { computePrEvents, prsForEntry } from './prs';
import { makeEntry, makeExercise, makeSession } from './test-helpers';

const exercise = makeExercise({ id: 'ex-1', repMin: 6, repMax: 12 });

describe('personal records (5.5)', () => {
  it('never on the first logged entry', () => {
    const first = makeEntry({ weight: 200, reps: [12, 12] });
    expect(prsForEntry(first, [], exercise.repMin)).toEqual([]);
  });

  it('weight PR: heaviest weight logged for at least repMin reps', () => {
    const prev = makeEntry({ weight: 100, reps: [8, 8] });
    expect(prsForEntry(makeEntry({ weight: 110, reps: [6, 5] }), [prev], 6)).toContain('weight');
  });

  it('no weight PR when the heavier weight missed repMin', () => {
    const prev = makeEntry({ weight: 100, reps: [8, 8] });
    expect(prsForEntry(makeEntry({ weight: 110, reps: [5, 4] }), [prev], 6)).not.toContain(
      'weight',
    );
  });

  it('rep PR: most reps in a single set at this weight or heavier', () => {
    const prev = makeEntry({ weight: 100, reps: [8, 8] });
    expect(prsForEntry(makeEntry({ weight: 100, reps: [9, 7] }), [prev], 6)).toContain('reps');
  });

  it('no rep PR when an earlier set at this weight or heavier had as many reps', () => {
    const prev = [makeEntry({ weight: 100, reps: [8] }), makeEntry({ weight: 90, reps: [12] })];
    expect(prsForEntry(makeEntry({ weight: 90, reps: [12] }), prev, 6)).not.toContain('reps');
    // 9 reps at 95 beats the 8 done at 100 (the only earlier set at 95 or heavier).
    expect(prsForEntry(makeEntry({ weight: 95, reps: [9] }), prev, 6)).toContain('reps');
  });

  it('heavier-weight history counts against a rep PR at a lighter weight', () => {
    const heavy = makeEntry({ weight: 120, reps: [10] });
    const light = makeEntry({ weight: 100, reps: [9] });
    expect(prsForEntry(light, [heavy], 6)).not.toContain('reps');
  });

  it('e1RM PR: highest estimated 1RM', () => {
    const prev = makeEntry({ weight: 100, reps: [10, 10] });
    expect(prsForEntry(makeEntry({ weight: 105, reps: [9, 8] }), [prev], 6)).toContain('e1rm');
    expect(prsForEntry(makeEntry({ weight: 100, reps: [10, 9] }), [prev], 6)).toEqual([]);
  });

  it('only the rep PR applies to unweighted entries', () => {
    const prev = makeEntry({ weight: null, reps: [15, 15] });
    expect(prsForEntry(makeEntry({ weight: null, reps: [16, 10] }), [prev], 10)).toEqual(['reps']);
  });

  it('compares across units', () => {
    const prevLb = makeEntry({ weight: 220, unit: 'lb', reps: [8] });
    const kg = makeEntry({ weight: 100, unit: 'kg', reps: [8] }); // 220.46 lb
    expect(prsForEntry(kg, [prevLb], 6)).toEqual(expect.arrayContaining(['weight', 'e1rm']));
  });
});

describe('PR events across history', () => {
  const sessions = [
    makeSession({ id: 'a', date: '2026-03-01' }),
    makeSession({ id: 'b', date: '2026-03-03' }),
    makeSession({ id: 'deload', date: '2026-03-05', deload: true }),
    makeSession({ id: 'c', date: '2026-03-07' }),
  ];
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const exercises = new Map([[exercise.id, exercise]]);

  it('lists PRs chronologically and excludes deload sessions entirely', () => {
    const entries = [
      makeEntry({ id: 'e1', sessionId: 'a', date: '2026-03-01', weight: 100, reps: [8, 8] }),
      makeEntry({ id: 'e2', sessionId: 'b', date: '2026-03-03', weight: 105, reps: [8, 8] }),
      // A deload entry neither earns a PR nor raises the bar.
      makeEntry({ id: 'e3', sessionId: 'deload', date: '2026-03-05', weight: 150, reps: [8] }),
      makeEntry({ id: 'e4', sessionId: 'c', date: '2026-03-07', weight: 110, reps: [8] }),
      makeEntry({ id: 'draft', sessionId: 'c', date: '2026-03-07', weight: 500, status: 'draft' }),
    ];
    const events = computePrEvents(entries, byId, exercises);
    expect(events.filter((e) => e.entryId === 'e1')).toEqual([]);
    expect(events.filter((e) => e.entryId === 'e3')).toEqual([]);
    expect(events.filter((e) => e.entryId === 'draft')).toEqual([]);
    expect(events.filter((e) => e.entryId === 'e2').map((e) => e.kind)).toEqual(
      expect.arrayContaining(['weight', 'e1rm']),
    );
    expect(events.filter((e) => e.entryId === 'e4').map((e) => e.kind)).toContain('weight');
    const weightPr = events.find((e) => e.entryId === 'e4' && e.kind === 'weight');
    expect(weightPr).toMatchObject({
      weight: 110,
      unit: 'lb',
      date: '2026-03-07',
      variantId: 'v-main',
    });
  });

  it('keeps variants separate', () => {
    const entries = [
      makeEntry({
        id: 'm1',
        sessionId: 'a',
        date: '2026-03-01',
        variantId: 'machine',
        weight: 100,
      }),
      makeEntry({ id: 'b1', sessionId: 'b', date: '2026-03-03', variantId: 'bench', weight: 150 }),
    ];
    expect(computePrEvents(entries, byId, exercises)).toEqual([]);
  });
});
