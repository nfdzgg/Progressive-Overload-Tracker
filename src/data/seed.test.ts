import { describe, expect, it } from 'vitest';
import { TYPE_DEFAULTS } from '../domain';
import { buildPplTemplate } from './seed';

let n = 0;
const template = buildPplTemplate(() => `id-${++n}`);
const byName = new Map(template.exercises.map((e) => [e.name, e]));
const nameOf = (id: string) => template.exercises.find((e) => e.id === id)?.name;

// Section 7, row by row: name, type, muscle, variants (first is default).
const TABLE: Array<[string, string, string, string[]]> = [
  ['Chest press', 'upperCompound', 'chest', ['Machine', 'Bench']],
  ['Incline press', 'upperCompound', 'chest', ['Bench']],
  [
    'Chest fly',
    'largeIsolation',
    'chest',
    ['Downstairs machine', 'Upstairs machine', 'Dumbbell on bench'],
  ],
  ['Lateral raise', 'smallIsolation', 'shoulders', ['Cable', 'Machine', 'Dumbbell']],
  ['Tricep overhead cable extension', 'smallIsolation', 'triceps', ['Cable']],
  ['Tricep pushdown', 'smallIsolation', 'triceps', ['Cable', 'Machine']],
  ['Lat pulldown', 'upperCompound', 'back', ['Wide grip', 'Short grip']],
  ['Row', 'upperCompound', 'back', ['Machine']],
  ['Rear delt fly', 'smallIsolation', 'shoulders', ['Machine', 'Cable']],
  ['Curl', 'smallIsolation', 'biceps', ['Preacher curl', 'Regular curl']],
  ['Hammer curl', 'smallIsolation', 'biceps', ['Dumbbell']],
  ['Leg press', 'legCompound', 'quads', ['Downstairs machine', 'Upstairs machine']],
  ['Romanian deadlift', 'legCompound', 'hamstrings', ['Bar']],
  ['Seated leg curl', 'largeIsolation', 'hamstrings', ['Downstairs machine', 'Upstairs machine']],
  ['Leg extension', 'largeIsolation', 'quads', ['Downstairs machine', 'Upstairs machine']],
  ['Incline bench crunch', 'smallIsolation', 'abs', ['Incline bench']],
];

describe('Push / Pull / Legs template (section 7)', () => {
  it('has exactly the 16 exercises in the table', () => {
    expect(template.exercises.map((e) => e.name)).toEqual(TABLE.map((row) => row[0]));
  });

  it.each(TABLE)('%s: type, muscle, variants, default variant', (name, type, muscle, variants) => {
    const ex = byName.get(name)!;
    expect(ex.type).toBe(type);
    expect(ex.muscleGroup).toBe(muscle);
    expect(ex.variants.map((v) => v.name)).toEqual(variants);
    expect(ex.defaultVariantId).toBe(ex.variants[0].id);
    expect(ex.sets).toBe(2);
    expect(ex.repMin).toBe(TYPE_DEFAULTS[ex.type].repMin);
    expect(ex.repMax).toBe(TYPE_DEFAULTS[ex.type].repMax);
    expect(ex.restSeconds).toBe(TYPE_DEFAULTS[ex.type].restSeconds);
    expect(ex.archived).toBe(false);
    expect(ex.variants.every((v) => v.note === '' && !v.archived)).toBe(true);
  });

  it('only Incline bench crunch has per-set weight', () => {
    expect(template.exercises.filter((e) => e.perSetWeight).map((e) => e.name)).toEqual([
      'Incline bench crunch',
    ]);
  });

  it('workouts list the exercises in order', () => {
    const workouts = Object.fromEntries(
      template.workouts.map((w) => [w.name, w.exerciseIds.map(nameOf)]),
    );
    expect(workouts).toEqual({
      Push: [
        'Chest press',
        'Incline press',
        'Chest fly',
        'Lateral raise',
        'Tricep overhead cable extension',
        'Tricep pushdown',
      ],
      Pull: ['Lat pulldown', 'Row', 'Rear delt fly', 'Lateral raise', 'Curl', 'Hammer curl'],
      Legs: [
        'Leg press',
        'Romanian deadlift',
        'Seated leg curl',
        'Leg extension',
        'Incline bench crunch',
      ],
    });
  });

  it('Lateral raise is one exercise shared by Push and Pull', () => {
    const lateral = byName.get('Lateral raise')!.id;
    const push = template.workouts.find((w) => w.name === 'Push')!;
    const pull = template.workouts.find((w) => w.name === 'Pull')!;
    expect(push.exerciseIds).toContain(lateral);
    expect(pull.exerciseIds).toContain(lateral);
    expect(template.exercises.filter((e) => e.name === 'Lateral raise')).toHaveLength(1);
  });

  it('cycle is Push, Pull, Legs, Push, Pull, Legs, Rest', () => {
    const names = template.cycleItems.map((item) =>
      item.kind === 'rest' ? 'Rest' : template.workouts.find((w) => w.id === item.workoutId)!.name,
    );
    expect(names).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest']);
  });

  it('uses unique ids', () => {
    const ids = [
      ...template.exercises.flatMap((e) => [e.id, ...e.variants.map((v) => v.id)]),
      ...template.workouts.map((w) => w.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
