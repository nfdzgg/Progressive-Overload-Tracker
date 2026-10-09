import { describe, expect, it } from 'vitest';
import { makeEntry, makeExercise } from '../../domain/test-helpers';
import type { Exercise, Prefill, Workout } from '../../domain';
import {
  activeVariants,
  canLog,
  entryValues,
  finishedRows,
  fitForm,
  untouchedForm,
  isBlankEntry,
  pendingSlotCount,
  pickVariantId,
  repPlaceholder,
  slotIds,
  targetLabel,
  withVariant,
} from './todayModel';

const machine = { id: 'v-machine', name: 'Machine', note: '', archived: false };
const bench = { id: 'v-bench', name: 'Bench', note: '', archived: false };
const old = { id: 'v-old', name: 'Old', note: '', archived: true };

function chestPress(overrides: Partial<Exercise> = {}): Exercise {
  return makeExercise({
    id: 'ex-chest',
    variants: [machine, bench, old],
    defaultVariantId: machine.id,
    ...overrides,
  });
}

const EMPTY_PREFILL: Prefill = { weight: '', setWeights: ['', ''], repPlaceholders: [null, null] };

describe('variants', () => {
  it('lists only active variants', () => {
    expect(activeVariants(chestPress()).map((v) => v.id)).toEqual(['v-machine', 'v-bench']);
  });

  it('picks the preferred variant when active, else the default, else the first active', () => {
    const ex = chestPress();
    expect(pickVariantId(ex, 'v-bench')).toBe('v-bench');
    expect(pickVariantId(ex, 'v-old')).toBe('v-machine');
    expect(pickVariantId(ex)).toBe('v-machine');
    const archivedDefault = chestPress({
      variants: [{ ...machine, archived: true }, bench],
    });
    expect(pickVariantId(archivedDefault)).toBe('v-bench');
  });
});

describe('untouched form', () => {
  it('without an entry: default variant, prefilled weight, empty reps', () => {
    const form = untouchedForm(chestPress(), undefined, 'lb', () => ({
      weight: '100',
      setWeights: ['', ''],
      repPlaceholders: ['10', '9'],
    }));
    expect(form).toEqual({
      variantId: 'v-machine',
      weight: '100',
      setWeights: ['', ''],
      reps: ['', ''],
    });
  });

  it('asks for the prefill of the chosen variant', () => {
    const asked: string[] = [];
    untouchedForm(chestPress(), undefined, 'lb', (variantId) => {
      asked.push(variantId);
      return EMPTY_PREFILL;
    });
    expect(asked).toEqual(['v-machine']);
  });

  it('with a draft: the typed values as values, in the display unit', () => {
    const entry = makeEntry({
      variantId: 'v-bench',
      unit: 'lb',
      weight: 102.5,
      reps: [10, null],
      status: 'draft',
    });
    const form = untouchedForm(chestPress(), entry, 'lb', () => EMPTY_PREFILL);
    expect(form).toEqual({
      variantId: 'v-bench',
      weight: '102.5',
      setWeights: ['', ''],
      reps: ['10', ''],
    });
  });

  it('converts a draft typed in another unit for display', () => {
    const entry = makeEntry({ unit: 'kg', weight: 50, reps: [8, 8], status: 'draft' });
    expect(untouchedForm(chestPress(), entry, 'lb', () => EMPTY_PREFILL).weight).toBe('110');
  });

  it('a draft with bodyweight keeps the weight empty', () => {
    const entry = makeEntry({ weight: null, reps: [12, null], status: 'draft' });
    expect(untouchedForm(chestPress(), entry, 'lb', () => EMPTY_PREFILL).weight).toBe('');
  });

  it('pads or trims the sets to the exercise set count', () => {
    const three = makeEntry({ reps: [10, 9, 8], status: 'draft' });
    expect(untouchedForm(chestPress(), three, 'lb', () => EMPTY_PREFILL).reps).toEqual(['10', '9']);
    const one = makeEntry({ reps: [10], status: 'draft' });
    expect(untouchedForm(chestPress({ sets: 3 }), one, 'lb', () => EMPTY_PREFILL).reps).toEqual([
      '10',
      '',
      '',
    ]);
  });

  it('per-set weight: each set gets its own weight (falling back to the entry weight)', () => {
    const ex = chestPress({ perSetWeight: true });
    const entry = makeEntry({ weight: null, reps: [12, 10], setWeights: [10, null] });
    expect(untouchedForm(ex, entry, 'lb', () => EMPTY_PREFILL)).toMatchObject({
      setWeights: ['10', ''],
      reps: ['12', '10'],
    });
    const legacy = makeEntry({ weight: 20, reps: [12, 10] });
    expect(untouchedForm(ex, legacy, 'lb', () => EMPTY_PREFILL).setWeights).toEqual(['20', '20']);
  });

  it('a blank entry (swap or reopened skip) uses the prefill for its variant', () => {
    const entry = makeEntry({
      variantId: 'v-bench',
      weight: null,
      sets: [
        { reps: null, weight: null },
        { reps: null, weight: null },
      ],
      status: 'draft',
    });
    expect(isBlankEntry(entry)).toBe(true);
    const form = untouchedForm(chestPress(), entry, 'lb', (variantId) => ({
      ...EMPTY_PREFILL,
      weight: variantId === 'v-bench' ? '135' : '100',
    }));
    expect(form).toMatchObject({ variantId: 'v-bench', weight: '135', reps: ['', ''] });
    expect(isBlankEntry(makeEntry({ weight: null, sets: [] }))).toBe(true);
    expect(isBlankEntry(makeEntry({ weight: 100, reps: [null, null] }))).toBe(false);
  });
});

describe('set count changes', () => {
  it('an edited form follows the exercise set count, keeping what was typed', () => {
    const form = { variantId: 'v', weight: '100', setWeights: ['', ''], reps: ['10', '9'] };
    expect(fitForm(form, chestPress({ sets: 3 }))).toEqual({
      ...form,
      setWeights: ['', '', ''],
      reps: ['10', '9', ''],
    });
    expect(fitForm(form, chestPress({ sets: 1 }))).toEqual({
      ...form,
      setWeights: [''],
      reps: ['10'],
    });
    expect(fitForm(form, chestPress())).toBe(form);
  });
});

describe('switching variant', () => {
  it('swaps the prefilled weight and keeps typed reps', () => {
    const form = { variantId: 'v-machine', weight: '100', setWeights: ['', ''], reps: ['10', ''] };
    const next = withVariant(form, chestPress(), 'v-bench', {
      weight: '135',
      setWeights: ['', ''],
      repPlaceholders: ['12', '12'],
    });
    expect(next).toEqual({
      variantId: 'v-bench',
      weight: '135',
      setWeights: ['', ''],
      reps: ['10', ''],
    });
  });

  it('per-set weight: swaps every set weight', () => {
    const ex = chestPress({ perSetWeight: true });
    const form = { variantId: 'v-machine', weight: '', setWeights: ['10', '10'], reps: ['', ''] };
    const next = withVariant(form, ex, 'v-bench', {
      weight: '',
      setWeights: ['15', ''],
      repPlaceholders: [null, null],
    });
    expect(next.setWeights).toEqual(['15', '']);
  });
});

describe('entry values', () => {
  it('parses the weight once and reps per set; empty weight is bodyweight', () => {
    const ex = chestPress();
    expect(
      entryValues({ variantId: 'v', weight: '102.5', setWeights: ['', ''], reps: ['10', ''] }, ex),
    ).toEqual({
      weight: 102.5,
      sets: [
        { reps: 10, weight: null },
        { reps: null, weight: null },
      ],
    });
    expect(
      entryValues({ variantId: 'v', weight: '', setWeights: ['', ''], reps: ['15', '12'] }, ex)
        .weight,
    ).toBeNull();
  });

  it('per-set weight: the entry weight is null and each set carries its own', () => {
    const ex = chestPress({ perSetWeight: true });
    expect(
      entryValues({ variantId: 'v', weight: '50', setWeights: ['10', ''], reps: ['12', '10'] }, ex),
    ).toEqual({
      weight: null,
      sets: [
        { reps: 12, weight: 10 },
        { reps: 10, weight: null },
      ],
    });
  });
});

describe('Log', () => {
  it('requires at least one set with reps', () => {
    const base = { variantId: 'v', weight: '100', setWeights: ['', ''] };
    expect(canLog({ ...base, reps: ['', ''] })).toBe(false);
    expect(canLog({ ...base, reps: ['0', ''] })).toBe(false);
    expect(canLog({ ...base, reps: ['', '8'] })).toBe(true);
  });
});

describe('labels', () => {
  it('rep placeholders show the reference reps, else the set label', () => {
    const prefill: Prefill = { weight: '', setWeights: ['', ''], repPlaceholders: ['10', null] };
    expect(repPlaceholder(prefill, 0)).toBe('10');
    expect(repPlaceholder(prefill, 1)).toBe('Set 2');
    expect(repPlaceholder(prefill, 5)).toBe('Set 6');
  });

  it('target labels', () => {
    const reference = makeEntry();
    expect(targetLabel({ kind: 'none' })).toBeNull();
    expect(targetLabel({ kind: 'beat', reference })).toBe('Beat: +1 rep');
    expect(targetLabel({ kind: 'addWeight', reference })).toBe('Add weight');
  });
});

describe('slots', () => {
  const a = makeExercise({ id: 'a' });
  const b = makeExercise({ id: 'b', archived: true });
  const c = makeExercise({ id: 'c' });
  const byId = new Map([a, b, c].map((e) => [e.id, e]));

  it("are the workout's existing, active exercises in order, without repeats", () => {
    const workout: Workout = { id: 'w', name: 'Push', exerciseIds: ['c', 'b', 'gone', 'a', 'c'] };
    expect(slotIds(workout, byId, [])).toEqual(['c', 'a']);
  });

  it("fall back to the session's entries when the workout was deleted", () => {
    const entries = [
      makeEntry({ exerciseId: 'c', createdAt: 2 }),
      makeEntry({ exerciseId: 'a', createdAt: 1 }),
      makeEntry({ exerciseId: 'c', swappedFromExerciseId: 'gone', createdAt: 3 }),
      makeEntry({ exerciseId: 'missing', createdAt: 4 }),
    ];
    expect(slotIds(undefined, byId, entries)).toEqual(['a', 'c', 'gone']);
  });

  it('counts slots that are not logged or skipped', () => {
    const entries = [
      makeEntry({ exerciseId: 'a', status: 'logged' }),
      makeEntry({ exerciseId: 'c', status: 'draft' }),
    ];
    expect(pendingSlotCount(['a', 'c'], entries)).toBe(1);
    expect(pendingSlotCount(['a', 'c', 'd'], entries)).toBe(2);
    expect(pendingSlotCount(['a'], entries)).toBe(0);
  });
});

describe('finished summary', () => {
  it('lists entries in workout order, then the rest by time', () => {
    const workout: Workout = { id: 'w', name: 'Push', exerciseIds: ['b', 'a'] };
    const entries = [
      makeEntry({ id: 'e-a', exerciseId: 'a', createdAt: 1 }),
      makeEntry({ id: 'e-x', exerciseId: 'x', createdAt: 0 }),
      makeEntry({ id: 'e-swap', exerciseId: 'y', swappedFromExerciseId: 'b', createdAt: 2 }),
      makeEntry({ id: 'e-z', exerciseId: 'z', createdAt: -1 }),
    ];
    expect(finishedRows(workout, entries).map((e) => e.id)).toEqual([
      'e-swap',
      'e-a',
      'e-z',
      'e-x',
    ]);
    expect(finishedRows(undefined, entries).map((e) => e.id)).toEqual([
      'e-z',
      'e-x',
      'e-a',
      'e-swap',
    ]);
  });
});
