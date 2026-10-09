import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addLoggedEntry,
  addVariant,
  cancelRestartAndStartNow,
  completeFirstRun,
  createExercise,
  createPastSession,
  createWorkout,
  deleteWorkout,
  ensureSession,
  exportBackupText,
  exportRoutineText,
  finishSession,
  getCycle,
  getSettings,
  importBackupText,
  importRoutineText,
  logEntry,
  readAllData,
  removeExercise,
  removeVariant,
  resolveCycleForToday,
  restartCycleOnMonday,
  saveCycleItems,
  saveDraft,
  setCycleDayToday,
  setDefaultVariant,
  setSessionDeload,
  skipSlot,
  swapSlot,
  trainAnywayToday,
  updateSettings,
  wipeAllData,
  type EntryInput,
} from './index';

const TODAY = '2026-03-02'; // a Monday

beforeEach(async () => {
  await wipeAllData();
});

async function pplSetup() {
  await completeFirstRun('template', 'lb', TODAY);
  const workouts = await db.workouts.toArray();
  const push = workouts.find((w) => w.name === 'Push')!;
  const exercises = await db.exercises.toArray();
  const byName = (name: string) => exercises.find((e) => e.name === name)!;
  return { push, byName };
}

function input(
  sessionId: string,
  exerciseId: string,
  variantId: string,
  reps: number[],
  weight: number | null = 100,
): EntryInput {
  return {
    sessionId,
    slotExerciseId: exerciseId,
    exerciseId,
    variantId,
    unit: 'lb',
    weight,
    sets: reps.map((r) => ({ reps: r, weight: null })),
  };
}

describe('first run', () => {
  it('template: writes the routine, cycle, unit, and onboarded', async () => {
    await completeFirstRun('template', 'kg', TODAY);
    expect(await db.exercises.count()).toBe(16);
    expect(await db.workouts.count()).toBe(3);
    const cycle = await getCycle(TODAY);
    expect(cycle.items).toHaveLength(7);
    expect(cycle.pointer).toBe(0);
    expect(await getSettings()).toMatchObject({
      unit: 'kg',
      onboarded: true,
      restTimerEnabled: true,
    });
  });

  it('blank: no routine, empty cycle', async () => {
    await completeFirstRun('blank', 'lb', TODAY);
    expect(await db.exercises.count()).toBe(0);
    expect((await getCycle(TODAY)).items).toEqual([]);
    expect((await getSettings()).onboarded).toBe(true);
  });
});

describe('logging a session', () => {
  it('drafts are saved per slot and never duplicated', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, TODAY);
    expect((await ensureSession(push.id, TODAY)).id).toBe(session.id);
    await saveDraft(input(session.id, press.id, press.defaultVariantId, [10]));
    await saveDraft(input(session.id, press.id, press.variants[1].id, [10, 8]));
    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 'draft', variantId: press.variants[1].id });
  });

  it('Log requires at least one set with reps', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, TODAY);
    await expect(
      logEntry(
        {
          ...input(session.id, press.id, press.defaultVariantId, []),
          sets: [{ reps: null, weight: null }],
        },
        TODAY,
      ),
    ).rejects.toThrow(/at least one set/);
  });

  it('logging every exercise finishes the session automatically and advances the pointer', async () => {
    const { push } = await pplSetup();
    const session = await ensureSession(push.id, TODAY);
    const exercises = await db.exercises.bulkGet(push.exerciseIds);
    let finished = false;
    for (const ex of exercises) {
      finished = (await logEntry(input(session.id, ex!.id, ex!.defaultVariantId, [10, 10]), TODAY))
        .sessionFinished;
    }
    expect(finished).toBe(true);
    expect((await db.sessions.get(session.id))!.status).toBe('finished');
    expect(await getCycle(TODAY)).toMatchObject({ pointer: 1, pointerSince: '2026-03-03' });
  });

  it('skipping counts as done for auto-finish', async () => {
    const { push } = await pplSetup();
    const session = await ensureSession(push.id, TODAY);
    const [first, ...rest] = push.exerciseIds;
    for (const id of rest) await skipSlot(session.id, id, TODAY);
    expect((await db.sessions.get(session.id))!.status).toBe('inProgress');
    const ex = (await db.exercises.get(first))!;
    expect(
      (await logEntry(input(session.id, ex.id, ex.defaultVariantId, [8]), TODAY)).sessionFinished,
    ).toBe(true);
  });

  it('Finish workout turns unlogged exercises into skipped entries', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, TODAY);
    await logEntry(input(session.id, press.id, press.defaultVariantId, [10]), TODAY);
    await saveDraft(
      input(session.id, byName('Incline press').id, byName('Incline press').defaultVariantId, [5]),
    );
    await finishSession(session.id, TODAY);
    const entries = await db.entries.where('sessionId').equals(session.id).toArray();
    expect(entries).toHaveLength(push.exerciseIds.length);
    expect(entries.filter((e) => e.status === 'logged')).toHaveLength(1);
    expect(entries.filter((e) => e.status === 'skipped')).toHaveLength(push.exerciseIds.length - 1);
    expect((await getCycle(TODAY)).pointer).toBe(1);
  });

  it('returns PRs for a logged entry (never the first, never in a deload session)', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const s1 = await ensureSession(push.id, '2026-02-23');
    expect(
      (await logEntry(input(s1.id, press.id, press.defaultVariantId, [10, 10], 100), '2026-02-23'))
        .prs,
    ).toEqual([]);
    await finishSession(s1.id, '2026-02-23');
    const s2 = await ensureSession(push.id, TODAY);
    const result = await logEntry(
      input(s2.id, press.id, press.defaultVariantId, [10, 10], 110),
      TODAY,
    );
    expect(result.prs).toEqual(expect.arrayContaining(['weight', 'e1rm']));
    await setSessionDeload(s2.id, true);
    const again = await logEntry(
      input(s2.id, press.id, press.defaultVariantId, [10, 10], 120),
      TODAY,
    );
    expect(again.prs).toEqual([]);
  });

  it('swap records the log against the exercise actually performed', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const row = byName('Row');
    const session = await ensureSession(push.id, TODAY);
    await swapSlot(session.id, press.id, row.id, 'lb');
    await logEntry(
      { ...input(session.id, row.id, row.defaultVariantId, [10]), slotExerciseId: press.id },
      TODAY,
    );
    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      exerciseId: row.id,
      swappedFromExerciseId: press.id,
      status: 'logged',
    });
    await swapSlot(session.id, press.id, press.id, 'lb');
    expect(await db.entries.count()).toBe(0);
  });

  it('an in-progress session from an earlier date is kept', async () => {
    const { push } = await pplSetup();
    const old = await ensureSession(push.id, '2026-02-27');
    expect((await ensureSession(push.id, TODAY)).id).toBe(old.id);
  });
});

describe('cycle actions', () => {
  it('rest day: resolves on open and Train anyway advances', async () => {
    await pplSetup();
    const cycle = await getCycle(TODAY);
    await saveCycleItems(cycle.items, TODAY, 6);
    expect((await trainAnywayToday(TODAY)).pointer).toBe(0);
  });

  it('restart on Monday waits; Start now restarts immediately', async () => {
    await pplSetup();
    await saveCycleItems((await getCycle(TODAY)).items, TODAY, 3);
    expect((await restartCycleOnMonday('2026-03-04')).restartOn).toBe('2026-03-09');
    expect((await resolveCycleForToday('2026-03-05')).pointer).toBe(3);
    expect(await resolveCycleForToday('2026-03-09')).toMatchObject({ pointer: 0, restartOn: null });
    await restartCycleOnMonday('2026-03-10');
    expect(await cancelRestartAndStartNow('2026-03-10')).toMatchObject({
      pointer: 0,
      restartOn: null,
    });
  });
});

describe('Day in cycle (joining mid-cycle)', () => {
  const FRIDAY = '2026-03-06';

  it('makes the chosen item today', async () => {
    await pplSetup();
    expect(await setCycleDayToday(1, FRIDAY)).toMatchObject({ pointer: 1, pointerSince: FRIDAY });
    expect((await getCycle(FRIDAY)).pointer).toBe(1);
  });

  it('discards a started workout with only unlogged numbers when another day is chosen', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, FRIDAY);
    await saveDraft(input(session.id, press.id, press.defaultVariantId, [10]));
    await setCycleDayToday(1, FRIDAY);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
  });

  it('keeps a started workout when its own day is chosen', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, FRIDAY);
    await saveDraft(input(session.id, press.id, press.defaultVariantId, [10]));
    await setCycleDayToday(3, FRIDAY); // the second Push in the cycle
    expect(await db.sessions.get(session.id)).toBeDefined();
    expect(await db.entries.count()).toBe(1);
    expect((await getCycle(FRIDAY)).pointer).toBe(3);
  });

  it('refuses while the started workout has logged sets, and changes nothing', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, FRIDAY);
    await logEntry(input(session.id, press.id, press.defaultVariantId, [10]), FRIDAY);
    await expect(setCycleDayToday(1, FRIDAY)).rejects.toThrow(/Finish/);
    expect((await getCycle(FRIDAY)).pointer).toBe(0);
    expect(await db.entries.count()).toBe(1);
  });
});

describe('library edits (4.3)', () => {
  it('an exercise with history is archived; without history it is deleted; both leave workouts', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const incline = byName('Incline press');
    const session = await ensureSession(push.id, TODAY);
    await logEntry(input(session.id, press.id, press.defaultVariantId, [10]), TODAY);
    expect(await removeExercise(press.id)).toBe('archived');
    expect(await removeExercise(incline.id)).toBe('deleted');
    expect((await db.exercises.get(press.id))!.archived).toBe(true);
    expect(await db.exercises.get(incline.id)).toBeUndefined();
    const updated = (await db.workouts.get(push.id))!;
    expect(updated.exerciseIds).not.toContain(press.id);
    expect(updated.exerciseIds).not.toContain(incline.id);
    expect(await db.entries.count()).toBe(1);
  });

  it('variants: archive with history, delete without, keep at least one, move the default', async () => {
    const ex = await createExercise({
      name: 'Curl',
      type: 'smallIsolation',
      muscleGroup: 'biceps',
      variantNames: ['Preacher', 'Regular'],
    });
    const [preacher, regular] = ex.variants;
    const workout = await createWorkout('Arms', [ex.id]);
    const session = await ensureSession(workout.id, TODAY);
    await logEntry(input(session.id, ex.id, preacher.id, [12]), TODAY);
    expect(await removeVariant(ex.id, preacher.id)).toBe('archived');
    let saved = (await db.exercises.get(ex.id))!;
    expect(saved.defaultVariantId).toBe(regular.id);
    await expect(removeVariant(ex.id, regular.id)).rejects.toThrow(/at least one variant/);
    const cable = await addVariant(ex.id, 'Cable');
    await setDefaultVariant(ex.id, cable.id);
    expect(await removeVariant(ex.id, regular.id)).toBe('deleted');
    saved = (await db.exercises.get(ex.id))!;
    expect(saved.variants.map((v) => [v.name, v.archived])).toEqual([
      ['Preacher', true],
      ['Cable', false],
    ]);
  });

  it('deleting a workout removes its cycle items', async () => {
    const { push } = await pplSetup();
    await deleteWorkout(push.id, TODAY);
    const cycle = await getCycle(TODAY);
    expect(cycle.items).toHaveLength(5);
    expect(cycle.items.some((i) => i.kind === 'workout' && i.workoutId === push.id)).toBe(false);
  });
});

describe('past days (calendar)', () => {
  it('adding a past session does not move the pointer', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await createPastSession('2026-02-20', push.id);
    expect(session.status).toBe('finished');
    await addLoggedEntry({
      sessionId: session.id,
      exerciseId: press.id,
      variantId: press.defaultVariantId,
      unit: 'lb',
      weight: 90,
      sets: [{ reps: 10, weight: null }],
    });
    expect((await getCycle(TODAY)).pointer).toBe(0);
    expect((await db.entries.toArray())[0]).toMatchObject({ date: '2026-02-20', status: 'logged' });
  });
});

describe('backup round trip (acceptance 11)', () => {
  it('export → wipe → import restores identical data', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, TODAY);
    await logEntry(input(session.id, press.id, press.defaultVariantId, [10, 9]), TODAY);
    await setSessionDeload(session.id, true);
    await updateSettings({ unit: 'kg', restTimerSound: false });
    const before = await readAllData(TODAY);
    const text = await exportBackupText(TODAY);
    await wipeAllData();
    expect(await db.exercises.count()).toBe(0);
    await importBackupText(text);
    expect(await readAllData(TODAY)).toEqual(before);
  });

  it('routine export contains no logs; importing it keeps history by name', async () => {
    const { push, byName } = await pplSetup();
    const press = byName('Chest press');
    const session = await ensureSession(push.id, TODAY);
    await logEntry(input(session.id, press.id, press.defaultVariantId, [10]), TODAY);
    const routineText = await exportRoutineText(TODAY);
    expect(routineText).not.toContain(session.id);
    expect(JSON.parse(routineText).data.sessions).toBeUndefined();
    const result = await importRoutineText(routineText, '2026-03-05');
    expect(result).toMatchObject({ matched: 16, created: 0 });
    expect(await db.exercises.count()).toBe(16);
    expect((await db.entries.toArray())[0].exerciseId).toBe(press.id);
    const cycle = await getCycle('2026-03-05');
    expect(cycle).toMatchObject({ pointer: 0, pointerSince: '2026-03-05' });
    expect(cycle.items).toHaveLength(7);
  });
});
