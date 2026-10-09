import { describe, expect, it } from 'vitest';
import { computeTarget, findReference, prefillFromReference, sortChronologically } from './targets';
import { makeEntry, makeExercise, makeSession } from './test-helpers';

const sessions = [
  makeSession({ id: 's1', date: '2026-03-01' }),
  makeSession({ id: 's2', date: '2026-03-03' }),
  makeSession({ id: 'deload', date: '2026-03-05', deload: true }),
  makeSession({ id: 'now', date: '2026-03-07', status: 'inProgress' }),
];
const byId = new Map(sessions.map((s) => [s.id, s]));

describe('reference entry (5.3)', () => {
  it('is the most recent logged entry for the exercise + variant', () => {
    const old = makeEntry({ id: 'old', sessionId: 's1', date: '2026-03-01' });
    const recent = makeEntry({ id: 'recent', sessionId: 's2', date: '2026-03-03' });
    expect(findReference([recent, old], byId, 'ex-1', 'v-main')?.id).toBe('recent');
  });

  it('ignores drafts and skipped entries', () => {
    const logged = makeEntry({ id: 'logged', sessionId: 's1', date: '2026-03-01' });
    const draft = makeEntry({ id: 'draft', sessionId: 's2', date: '2026-03-03', status: 'draft' });
    const skipped = makeEntry({
      id: 'skip',
      sessionId: 's2',
      date: '2026-03-03',
      status: 'skipped',
    });
    expect(findReference([logged, draft, skipped], byId, 'ex-1', 'v-main')?.id).toBe('logged');
  });

  it('excludes deload sessions', () => {
    const normal = makeEntry({ id: 'normal', sessionId: 's2', date: '2026-03-03' });
    const deload = makeEntry({ id: 'deload-e', sessionId: 'deload', date: '2026-03-05' });
    expect(findReference([normal, deload], byId, 'ex-1', 'v-main')?.id).toBe('normal');
  });

  it('keeps variant history separate', () => {
    const machine = makeEntry({
      id: 'm',
      sessionId: 's1',
      date: '2026-03-01',
      variantId: 'machine',
    });
    const bench = makeEntry({ id: 'b', sessionId: 's2', date: '2026-03-03', variantId: 'bench' });
    expect(findReference([machine, bench], byId, 'ex-1', 'machine')?.id).toBe('m');
    expect(findReference([machine, bench], byId, 'ex-1', 'bench')?.id).toBe('b');
    expect(findReference([machine, bench], byId, 'ex-1', 'cable')).toBeNull();
  });

  it("excludes the current session's own entry", () => {
    const prev = makeEntry({ id: 'prev', sessionId: 's2', date: '2026-03-03' });
    const current = makeEntry({ id: 'cur', sessionId: 'now', date: '2026-03-07' });
    expect(
      findReference([prev, current], byId, 'ex-1', 'v-main', { excludeSessionId: 'now' })?.id,
    ).toBe('prev');
  });

  it('breaks same-date ties by creation time', () => {
    const first = makeEntry({ id: 'first', sessionId: 's2', date: '2026-03-03', createdAt: 1 });
    const second = makeEntry({ id: 'second', sessionId: 's2', date: '2026-03-03', createdAt: 2 });
    expect(findReference([second, first], byId, 'ex-1', 'v-main')?.id).toBe('second');
    expect(sortChronologically([second, first]).map((e) => e.id)).toEqual(['first', 'second']);
  });
});

describe('target (5.3)', () => {
  it('no reference: nothing to beat', () => {
    expect(computeTarget(null, 12)).toEqual({ kind: 'none' });
  });

  it('every set reached repMax: add weight', () => {
    const ref = makeEntry({ reps: [12, 12] });
    expect(computeTarget(ref, 12)).toEqual({ kind: 'addWeight', reference: ref });
  });

  it('otherwise: beat the reference', () => {
    const ref = makeEntry({ reps: [12, 11] });
    expect(computeTarget(ref, 12)).toEqual({ kind: 'beat', reference: ref });
  });

  it('a set with no reps did not reach repMax', () => {
    const ref = makeEntry({ reps: [12, null] });
    expect(computeTarget(ref, 12).kind).toBe('beat');
  });
});

describe('prefill (5.3)', () => {
  it('prefills the weight and uses reference reps as placeholders', () => {
    const ex = makeExercise({ sets: 3 });
    const ref = makeEntry({ weight: 100, reps: [10, 9] });
    expect(prefillFromReference(ref, ex, 'lb')).toEqual({
      weight: '100',
      setWeights: ['', '', ''],
      repPlaceholders: ['10', '9', null],
    });
  });

  it('converts the prefilled weight to the display unit', () => {
    const ref = makeEntry({ weight: 100, unit: 'kg', reps: [10, 9] });
    expect(prefillFromReference(ref, makeExercise(), 'lb').weight).toBe('220.5');
  });

  it('leaves the weight empty for a bodyweight reference', () => {
    const ref = makeEntry({ weight: null, reps: [15, 12] });
    expect(prefillFromReference(ref, makeExercise(), 'lb').weight).toBe('');
  });

  it('prefills per-set weights when perSetWeight is on', () => {
    const ex = makeExercise({ perSetWeight: true });
    const ref = makeEntry({ weight: null, reps: [15, 12], setWeights: [10, null] });
    expect(prefillFromReference(ref, ex, 'lb')).toEqual({
      weight: '',
      setWeights: ['10', ''],
      repPlaceholders: ['15', '12'],
    });
  });

  it('no reference: no prefill', () => {
    expect(prefillFromReference(null, makeExercise(), 'lb')).toEqual({
      weight: '',
      setWeights: ['', ''],
      repPlaceholders: [null, null],
    });
  });
});
