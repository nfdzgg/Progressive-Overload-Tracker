import { describe, expect, it } from 'vitest';
import { TYPE_DEFAULTS, type Exercise } from '../../domain';
import {
  exercisePatch,
  exerciseSummary,
  formFromExercise,
  hasErrors,
  newExerciseForm,
  newExerciseInput,
  parseReps,
  restOptions,
  validateExerciseForm,
  validateName,
  validateVariantName,
  withType,
} from './exerciseForm';

const exercise: Exercise = {
  id: 'ex',
  name: 'Chest press',
  type: 'upperCompound',
  muscleGroup: 'chest',
  sets: 2,
  repMin: 6,
  repMax: 12,
  restSeconds: 150,
  variants: [
    { id: 'm', name: 'Machine', note: '', archived: false },
    { id: 'b', name: 'Bench', note: '', archived: false },
    { id: 'o', name: 'Old', note: '', archived: true },
  ],
  defaultVariantId: 'm',
  perSetWeight: false,
  archived: false,
};

describe('new exercise form', () => {
  it('starts with 2 sets and the defaults of its type', () => {
    const form = newExerciseForm('legCompound');
    expect(form).toMatchObject({
      name: '',
      type: 'legCompound',
      sets: 2,
      repMin: '6',
      repMax: '12',
      restSeconds: 180,
      perSetWeight: false,
    });
  });

  it('choosing a type fills in its rep range and rest (SPEC 4.1)', () => {
    const form = { ...newExerciseForm('legCompound'), name: 'Curl', repMin: '8', sets: 3 };
    const next = withType(form, 'smallIsolation', true);
    expect(next).toMatchObject({
      name: 'Curl',
      sets: 3,
      type: 'smallIsolation',
      repMin: String(TYPE_DEFAULTS.smallIsolation.repMin),
      repMax: String(TYPE_DEFAULTS.smallIsolation.repMax),
      restSeconds: TYPE_DEFAULTS.smallIsolation.restSeconds,
    });
  });

  it('changing the type of an existing exercise keeps its values', () => {
    const form = formFromExercise(exercise);
    expect(withType(form, 'smallIsolation', false)).toEqual({ ...form, type: 'smallIsolation' });
  });

  it('builds the create input and the follow-up patch from the form', () => {
    const form = {
      ...newExerciseForm('upperCompound'),
      name: '  Dips ',
      muscleGroup: 'triceps' as const,
      sets: 3,
      repMin: '8',
      repMax: '10',
      restSeconds: 120,
      perSetWeight: true,
    };
    expect(newExerciseInput(form, ' Bodyweight ')).toEqual({
      name: 'Dips',
      type: 'upperCompound',
      muscleGroup: 'triceps',
      sets: 3,
      perSetWeight: true,
      variantNames: ['Bodyweight'],
    });
    expect(newExerciseInput(form, '  ').variantNames).toBeUndefined();
    expect(exercisePatch(form, validateExerciseForm(form, []))).toMatchObject({
      repMin: 8,
      repMax: 10,
      restSeconds: 120,
    });
  });
});

describe('formFromExercise', () => {
  it('copies the editable fields', () => {
    expect(formFromExercise(exercise)).toEqual({
      name: 'Chest press',
      type: 'upperCompound',
      muscleGroup: 'chest',
      sets: 2,
      repMin: '6',
      repMax: '12',
      restSeconds: 150,
      perSetWeight: false,
    });
  });
});

describe('parseReps', () => {
  it('accepts whole numbers from 1 to 100', () => {
    expect(parseReps('1')).toBe(1);
    expect(parseReps('100')).toBe(100);
    expect(parseReps(' 12 ')).toBe(12);
  });

  it('rejects empty, zero, fractions, and too many', () => {
    expect(parseReps('')).toBeNull();
    expect(parseReps('0')).toBeNull();
    expect(parseReps('7.5')).toBeNull();
    expect(parseReps('101')).toBeNull();
    expect(parseReps('abc')).toBeNull();
  });
});

describe('validateExerciseForm', () => {
  const valid = formFromExercise(exercise);

  it('passes a valid form', () => {
    const errors = validateExerciseForm(valid, ['Row']);
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it('requires a name that is not taken (case-insensitive)', () => {
    expect(validateExerciseForm({ ...valid, name: '  ' }, []).name).toBe('Enter a name');
    expect(validateExerciseForm({ ...valid, name: 'row ' }, ['Row']).name).toBe(
      'An exercise with this name already exists',
    );
  });

  it('requires rep min ≤ rep max', () => {
    const errors = validateExerciseForm({ ...valid, repMin: '15', repMax: '12' }, []);
    expect(errors.repMax).toBe("Max can't be below min");
    expect(errors.repMin).toBeUndefined();
    expect(hasErrors(errors)).toBe(true);
    expect(validateExerciseForm({ ...valid, repMin: '12', repMax: '12' }, [])).toEqual({});
  });

  it('flags unreadable rep fields', () => {
    const errors = validateExerciseForm({ ...valid, repMin: '', repMax: '0' }, []);
    expect(errors.repMin).toBe('1 to 100');
    expect(errors.repMax).toBe('1 to 100');
  });
});

describe('exercisePatch', () => {
  const valid = formFromExercise(exercise);

  it('includes every field when the form is valid', () => {
    const form = { ...valid, name: ' Press ', repMin: '8', repMax: '10', sets: 4 };
    expect(exercisePatch(form, validateExerciseForm(form, []))).toEqual({
      name: 'Press',
      type: 'upperCompound',
      muscleGroup: 'chest',
      sets: 4,
      repMin: 8,
      repMax: 10,
      restSeconds: 150,
      perSetWeight: false,
    });
  });

  it('leaves out an invalid name and an invalid rep range', () => {
    const form = { ...valid, name: '', repMin: '15', repMax: '12', sets: 3 };
    const patch = exercisePatch(form, validateExerciseForm(form, []));
    expect(patch).not.toHaveProperty('name');
    expect(patch).not.toHaveProperty('repMin');
    expect(patch).not.toHaveProperty('repMax');
    expect(patch.sets).toBe(3);
  });
});

describe('restOptions', () => {
  it('offers 30-second steps up to 5:00', () => {
    const options = restOptions(90);
    expect(options[0]).toEqual({ value: '30', label: '0:30' });
    expect(options.at(-1)).toEqual({ value: '300', label: '5:00' });
    expect(options).toHaveLength(10);
  });

  it('keeps a current value that is off the steps, in order', () => {
    const options = restOptions(100);
    expect(options.map((o) => o.value)).toContain('100');
    const values = options.map((o) => Number(o.value));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(restOptions(420).at(-1)).toEqual({ value: '420', label: '7:00' });
  });
});

describe('exerciseSummary', () => {
  it('reads muscle group, sets × rep range, and rest', () => {
    expect(exerciseSummary(exercise)).toBe('Chest · 2 × 6–12 · 2:30 rest');
    expect(exerciseSummary(exercise, false)).toBe('Chest · 2 × 6–12');
  });
});

describe('name validation', () => {
  it('validateName requires text', () => {
    expect(validateName('')).toBe('Enter a name');
    expect(validateName(' Push ')).toBeUndefined();
  });

  it('validateVariantName rejects duplicates among active variants only', () => {
    expect(validateVariantName('bench', exercise.variants)).toBe(
      'This exercise already has that variant',
    );
    // Renaming a variant to its own name is fine.
    expect(validateVariantName('Bench', exercise.variants, 'b')).toBeUndefined();
    // Archived names may be reused.
    expect(validateVariantName('Old', exercise.variants)).toBeUndefined();
    expect(validateVariantName(' ', exercise.variants)).toBe('Enter a name');
  });
});
