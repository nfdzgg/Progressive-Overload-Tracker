import { describe, expect, it } from 'vitest';
import {
  buildExercise,
  clampSets,
  EXERCISE_TYPE_LABELS,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  TYPE_DEFAULTS,
} from './exerciseTypes';

describe('exercise type defaults (4.1)', () => {
  it('matches the table', () => {
    expect(TYPE_DEFAULTS.legCompound).toEqual({ repMin: 6, repMax: 12, restSeconds: 180 });
    expect(TYPE_DEFAULTS.upperCompound).toEqual({ repMin: 6, repMax: 12, restSeconds: 150 });
    expect(TYPE_DEFAULTS.largeIsolation).toEqual({ repMin: 10, repMax: 15, restSeconds: 120 });
    expect(TYPE_DEFAULTS.smallIsolation).toEqual({ repMin: 10, repMax: 15, restSeconds: 90 });
    expect(EXERCISE_TYPES).toHaveLength(4);
    expect(Object.keys(EXERCISE_TYPE_LABELS)).toHaveLength(4);
    expect(MUSCLE_GROUPS).toHaveLength(10);
  });

  it('builds an exercise with type defaults, 2 sets, and the first variant as default', () => {
    let n = 0;
    const ex = buildExercise(
      {
        name: 'Leg press',
        type: 'legCompound',
        muscleGroup: 'quads',
        variantNames: ['Downstairs', 'Upstairs'],
      },
      () => `id-${++n}`,
    );
    expect(ex).toMatchObject({
      name: 'Leg press',
      type: 'legCompound',
      muscleGroup: 'quads',
      sets: 2,
      repMin: 6,
      repMax: 12,
      restSeconds: 180,
      perSetWeight: false,
      archived: false,
    });
    expect(ex.variants.map((v) => v.name)).toEqual(['Downstairs', 'Upstairs']);
    expect(ex.defaultVariantId).toBe(ex.variants[0].id);
  });

  it('always has at least one variant', () => {
    const ex = buildExercise(
      { name: 'Plank', type: 'smallIsolation', muscleGroup: 'abs' },
      () => 'x',
    );
    expect(ex.variants).toHaveLength(1);
    expect(ex.variants[0].name).toBe('Standard');
  });

  it('clamps sets to 1–10', () => {
    expect(clampSets(0)).toBe(1);
    expect(clampSets(11)).toBe(10);
    expect(clampSets(3)).toBe(3);
  });
});
