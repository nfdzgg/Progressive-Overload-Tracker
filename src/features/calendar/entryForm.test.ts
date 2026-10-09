import { describe, expect, it } from 'vitest';
import { makeEntry, makeExercise } from '../../domain/test-helpers';
import {
  blankForm,
  canSave,
  entryDetail,
  entryPatch,
  formFromEntry,
  newEntryInput,
  usesPerSetWeight,
  variantOptions,
} from './entryForm';

const chest = makeExercise({
  id: 'chest',
  name: 'Chest press',
  sets: 2,
  variants: [
    { id: 'machine', name: 'Machine', note: '', archived: false },
    { id: 'smith', name: 'Smith', note: '', archived: true },
    { id: 'bench', name: 'Bench', note: '', archived: false },
  ],
  defaultVariantId: 'machine',
});

const crunch = makeExercise({ id: 'crunch', name: 'Crunch', perSetWeight: true, sets: 2 });

describe('variant choices', () => {
  it('offers the active variants', () => {
    expect(variantOptions(chest, 'machine').map((v) => v.id)).toEqual(['machine', 'bench']);
  });

  it("keeps the entry's own variant even when it is archived", () => {
    expect(variantOptions(chest, 'smith').map((v) => v.id)).toEqual(['machine', 'smith', 'bench']);
  });
});

describe('per-set weight', () => {
  it('follows the exercise, or an entry that was typed with per-set weights', () => {
    expect(usesPerSetWeight(crunch)).toBe(true);
    expect(usesPerSetWeight(chest)).toBe(false);
    expect(usesPerSetWeight(chest, makeEntry({ weight: null, setWeights: [10, null] }))).toBe(true);
    expect(usesPerSetWeight(chest, makeEntry({ weight: 100 }))).toBe(false);
  });
});

describe('form from an entry', () => {
  it('shows the typed numbers in the display unit', () => {
    const entry = makeEntry({
      exerciseId: 'chest',
      variantId: 'bench',
      weight: 100,
      reps: [10, 9],
    });
    expect(formFromEntry(entry, chest, 'lb')).toEqual({
      variantId: 'bench',
      weight: '100',
      setWeights: ['', ''],
      reps: ['10', '9'],
    });
    const kg = makeEntry({ unit: 'kg', weight: 40, reps: [8, null] });
    expect(formFromEntry(kg, chest, 'lb')).toMatchObject({ weight: '88', reps: ['8', ''] });
  });

  it('bodyweight stays empty; a skipped entry gets one empty field per set', () => {
    const bw = makeEntry({ weight: null, reps: [15, 12] });
    expect(formFromEntry(bw, chest, 'lb').weight).toBe('');
    const skipped = makeEntry({ status: 'skipped', weight: null, sets: [] });
    expect(formFromEntry(skipped, chest, 'lb').reps).toEqual(['', '']);
  });

  it('keeps every logged set even when the exercise now has fewer', () => {
    const entry = makeEntry({ reps: [10, 9, 8] });
    expect(formFromEntry(entry, chest, 'lb').reps).toEqual(['10', '9', '8']);
  });

  it('per-set weights fill each set (falling back to the entry weight)', () => {
    const entry = makeEntry({ weight: null, reps: [12, 10], setWeights: [10, null] });
    expect(formFromEntry(entry, crunch, 'lb')).toMatchObject({
      setWeights: ['10', ''],
      reps: ['12', '10'],
    });
  });
});

describe('blank form (logging after the fact)', () => {
  it('starts on the default variant with one empty field per set', () => {
    expect(blankForm(chest)).toEqual({
      variantId: 'machine',
      weight: '',
      setWeights: ['', ''],
      reps: ['', ''],
    });
  });

  it('falls back to the first active variant when the default is archived', () => {
    const exercise = { ...chest, defaultVariantId: 'smith' };
    expect(blankForm(exercise).variantId).toBe('machine');
  });
});

describe('saving', () => {
  const form = { variantId: 'machine', weight: '100', setWeights: ['', ''], reps: ['10', '9'] };

  it('needs reps in at least one set', () => {
    expect(canSave(form)).toBe(true);
    expect(canSave({ ...form, reps: ['', '0'] })).toBe(false);
  });

  it('saves the edited reps and variant as a logged entry', () => {
    const entry = makeEntry({ variantId: 'machine', weight: 100, reps: [10, 9] });
    const initial = formFromEntry(entry, chest, 'lb');
    const patch = entryPatch(
      entry,
      initial,
      { ...initial, variantId: 'bench', reps: ['11', '9'] },
      false,
      'lb',
    );
    expect(patch).toEqual({
      variantId: 'bench',
      unit: 'lb',
      weight: 100,
      sets: [
        { reps: 11, weight: null },
        { reps: 9, weight: null },
      ],
      status: 'logged',
    });
  });

  it('a skipped entry given reps becomes logged', () => {
    const entry = makeEntry({ status: 'skipped', weight: null, sets: [] });
    const initial = formFromEntry(entry, chest, 'lb');
    const patch = entryPatch(
      entry,
      initial,
      { ...initial, weight: '50', reps: ['8', ''] },
      false,
      'lb',
    );
    expect(patch).toMatchObject({ status: 'logged', weight: 50, unit: 'lb' });
    expect(patch.sets).toEqual([
      { reps: 8, weight: null },
      { reps: null, weight: null },
    ]);
  });

  it('untouched weights keep the stored number and unit (no rounding drift)', () => {
    const entry = makeEntry({ unit: 'kg', weight: 40, reps: [8, 8] });
    const initial = formFromEntry(entry, chest, 'lb');
    const patch = entryPatch(entry, initial, { ...initial, reps: ['9', '8'] }, false, 'lb');
    expect(patch).toMatchObject({ unit: 'kg', weight: 40 });
    expect(patch.sets?.map((s) => s.reps)).toEqual([9, 8]);
  });

  it('a changed weight is saved as typed, in the display unit', () => {
    const entry = makeEntry({ unit: 'kg', weight: 40, reps: [8, 8] });
    const initial = formFromEntry(entry, chest, 'lb');
    const patch = entryPatch(entry, initial, { ...initial, weight: '95' }, false, 'lb');
    expect(patch).toMatchObject({ unit: 'lb', weight: 95 });
    const cleared = entryPatch(entry, initial, { ...initial, weight: '' }, false, 'lb');
    expect(cleared).toMatchObject({ unit: 'lb', weight: null });
  });

  it('per-set weights: an untouched entry keeps its set weights; a change saves all as shown', () => {
    const entry = makeEntry({ unit: 'kg', weight: null, reps: [12, 10], setWeights: [10, null] });
    const initial = formFromEntry(entry, crunch, 'lb');
    expect(initial.setWeights).toEqual(['22', '']);
    const same = entryPatch(entry, initial, { ...initial, reps: ['13', '10'] }, true, 'lb');
    expect(same).toMatchObject({
      unit: 'kg',
      weight: null,
      sets: [
        { reps: 13, weight: 10 },
        { reps: 10, weight: null },
      ],
    });
    const changed = entryPatch(
      entry,
      initial,
      { ...initial, setWeights: ['22', '25'] },
      true,
      'lb',
    );
    expect(changed).toMatchObject({
      unit: 'lb',
      weight: null,
      sets: [
        { reps: 12, weight: 22 },
        { reps: 10, weight: 25 },
      ],
    });
  });

  it('builds a new logged entry for a past session', () => {
    expect(
      newEntryInput('s-1', chest, { ...form, variantId: 'bench', weight: '' }, false, 'kg'),
    ).toEqual({
      sessionId: 's-1',
      exerciseId: 'chest',
      variantId: 'bench',
      unit: 'kg',
      weight: null,
      sets: [
        { reps: 10, weight: null },
        { reps: 9, weight: null },
      ],
    });
  });
});

describe('row detail', () => {
  it('shows variant and numbers, "Skipped", or "Not logged"', () => {
    expect(
      entryDetail(makeEntry({ variantId: 'bench', weight: 100, reps: [10, 9] }), chest, 'lb'),
    ).toBe('Bench · 100 lb × 10, 9');
    expect(
      entryDetail(
        makeEntry({ variantId: 'machine', unit: 'kg', weight: 40, reps: [8] }),
        chest,
        'lb',
      ),
    ).toBe('Machine · 88 lb × 8');
    expect(entryDetail(makeEntry({ status: 'skipped', sets: [] }), chest, 'lb')).toBe('Skipped');
    expect(entryDetail(makeEntry({ status: 'draft', reps: [null, null] }), chest, 'lb')).toBe(
      'Not logged',
    );
    expect(entryDetail(makeEntry({ weight: 100, reps: [10] }), undefined, 'lb')).toBe(
      '100 lb × 10',
    );
  });
});
