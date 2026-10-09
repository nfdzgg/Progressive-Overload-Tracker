import { describe, expect, it } from 'vitest';
import { makeEntry, makeExercise, makeSession, REST, W } from '../domain/test-helpers';
import { DEFAULT_SETTINGS } from '../domain';
import {
  BackupError,
  entriesToCsv,
  extractRoutine,
  mergeRoutine,
  parseBackup,
  parseRoutine,
  serializeBackup,
  serializeRoutine,
  type BackupData,
} from './backup';
import { migrateData } from './migrations';

function sample(): BackupData {
  const press = makeExercise({
    id: 'press',
    name: 'Chest press',
    variants: [
      { id: 'machine', name: 'Machine', note: 'Seat 4', archived: false },
      { id: 'bench', name: 'Bench', note: '', archived: true },
    ],
    defaultVariantId: 'machine',
  });
  const old = makeExercise({ id: 'old', name: 'Old fly', archived: true });
  return {
    exercises: [press, old],
    workouts: [{ id: 'push', name: 'Push', exerciseIds: ['press'] }],
    cycle: {
      items: [W('push'), REST],
      pointer: 1,
      pointerSince: '2026-03-03',
      restartOn: '2026-03-09',
    },
    sessions: [makeSession({ id: 's1', date: '2026-03-02', deload: true, createdAt: 5 })],
    entries: [
      makeEntry({
        id: 'e1',
        sessionId: 's1',
        exerciseId: 'press',
        variantId: 'machine',
        weight: 100,
        reps: [10, 9],
        createdAt: 6,
      }),
      makeEntry({
        id: 'e2',
        sessionId: 's1',
        exerciseId: 'press',
        variantId: 'machine',
        weight: null,
        reps: [12, null],
        setWeights: [20, null],
        status: 'skipped',
      }),
    ],
    settings: {
      ...DEFAULT_SETTINGS,
      unit: 'kg',
      onboarded: true,
      lastExportAt: '2026-03-01T10:00:00.000Z',
    },
  };
}

describe('full backup', () => {
  it('round-trips: parse(serialize(data)) equals the data', () => {
    const data = sample();
    const parsed = parseBackup(serializeBackup(data, '2026-03-05T00:00:00.000Z'));
    expect(parsed).toEqual({
      ...data,
      exercises: [...data.exercises].sort((a, b) => a.id.localeCompare(b.id)),
    });
  });

  it('carries the app name, kind, and schemaVersion', () => {
    const file = JSON.parse(serializeBackup(sample(), '2026-03-05T00:00:00.000Z'));
    expect(file).toMatchObject({
      app: 'progressive-overload-tracker',
      kind: 'backup',
      schemaVersion: 1,
      exportedAt: '2026-03-05T00:00:00.000Z',
    });
  });

  it('rejects files that are not backups, with a readable message', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Progressive Overload Tracker file/);
    const routine = serializeRoutine(extractRoutine(sample()), 'now');
    expect(() => parseBackup(routine)).toThrow(/routine file/);
  });

  it('rejects malformed records', () => {
    const file = JSON.parse(serializeBackup(sample(), 'now'));
    file.data.entries[0].date = '2026/03/02';
    expect(() => parseBackup(JSON.stringify(file))).toThrow(/entries\[0\]\.date/);
    const file2 = JSON.parse(serializeBackup(sample(), 'now'));
    file2.data.exercises[0].type = 'cardio';
    expect(() => parseBackup(JSON.stringify(file2))).toThrow(/exercises\[0\]\.type/);
  });

  it('rejects backups from a newer schema', () => {
    const file = JSON.parse(serializeBackup(sample(), 'now'));
    file.schemaVersion = 99;
    expect(() => parseBackup(JSON.stringify(file))).toThrow(/newer version/);
  });
});

describe('migrations', () => {
  it('runs each step from the file version up to the current one', () => {
    const steps = {
      1: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
      2: (d: Record<string, unknown>) => ({ ...d, b: 2 }),
    };
    expect(migrateData({ x: 0 }, 1, 3, steps)).toEqual({ x: 0, a: 1, b: 2 });
    expect(migrateData({ x: 0 }, 3, 3, steps)).toEqual({ x: 0 });
    expect(() => migrateData({}, 1, 3, { 1: steps[1] })).toThrow(/No migration from schema 2/);
    expect(() => migrateData({}, 0, 1)).toThrow(/Unknown schema version/);
  });

  it('fills fields an older file may lack', () => {
    const file = JSON.parse(serializeBackup(sample(), 'now'));
    delete file.data.entries[0].createdAt;
    delete file.data.sessions[0].createdAt;
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.entries.find((e) => e.id === 'e1')?.createdAt).toBe(0);
    expect(parsed.sessions[0].createdAt).toBe(0);
  });
});

describe('routine only', () => {
  it('contains no logs, sessions, or settings, and drops archived items', () => {
    const routine = extractRoutine(sample());
    const text = serializeRoutine(routine, 'now');
    const file = JSON.parse(text);
    expect(Object.keys(file.data).sort()).toEqual(['cycleItems', 'exercises', 'workouts']);
    expect(text).not.toContain('sessionId');
    expect(routine.exercises.map((e) => e.id)).toEqual(['press']);
    expect(routine.exercises[0].variants.map((v) => v.name)).toEqual(['Machine']);
    expect(parseRoutine(text)).toEqual(routine);
  });

  it('rejects a routine whose workouts reference unknown exercises', () => {
    const file = JSON.parse(serializeRoutine(extractRoutine(sample()), 'now'));
    file.data.workouts[0].exerciseIds.push('ghost');
    expect(() => parseRoutine(JSON.stringify(file))).toThrow(BackupError);
  });

  it('import matches exercises by name (case-insensitive), creates the rest, replaces workouts', () => {
    const existing = [
      makeExercise({
        id: 'mine',
        name: 'chest PRESS',
        sets: 3,
        variants: [{ id: 'my-machine', name: 'machine', note: 'old note', archived: true }],
        defaultVariantId: 'my-machine',
        archived: true,
      }),
    ];
    const routine = {
      exercises: [
        makeExercise({
          id: 'f-press',
          name: 'Chest press',
          sets: 2,
          variants: [
            { id: 'f-machine', name: 'Machine', note: 'Seat 4', archived: false },
            { id: 'f-bench', name: 'Bench', note: '', archived: false },
          ],
          defaultVariantId: 'f-bench',
        }),
        makeExercise({ id: 'f-row', name: 'Row', defaultVariantId: 'f-row-v' }),
      ],
      workouts: [{ id: 'f-w', name: 'Upper', exerciseIds: ['f-press', 'f-row'] }],
      cycleItems: [W('f-w'), REST],
    };
    let n = 0;
    const merge = mergeRoutine(existing, routine, () => `new-${++n}`);
    expect(merge.matched).toBe(1);
    expect(merge.created).toBe(1);
    const press = merge.exercises.find((e) => e.id === 'mine')!;
    expect(press).toMatchObject({ name: 'chest PRESS', sets: 2, archived: false });
    expect(press.variants.map((v) => [v.id, v.name, v.note, v.archived])).toEqual([
      ['my-machine', 'machine', 'Seat 4', false],
      [press.variants[1].id, 'Bench', '', false],
    ]);
    expect(press.defaultVariantId).toBe(press.variants[1].id);
    const row = merge.exercises.find((e) => e.name === 'Row')!;
    expect(row.id).toMatch(/^new-/);
    expect(row.defaultVariantId).toBe(row.variants[0].id);
    expect(merge.workouts).toEqual([
      { id: expect.stringMatching(/^new-/), name: 'Upper', exerciseIds: ['mine', row.id] },
    ]);
    expect(merge.cycleItems).toEqual([W(merge.workouts[0].id), REST]);
  });
});

describe('CSV export', () => {
  it('writes one row per logged set with names, escaping commas', () => {
    const data = sample();
    data.exercises[0].name = 'Press, chest';
    const csv = entriesToCsv(data);
    expect(csv.split('\n')).toEqual([
      'date,workout,exercise,variant,set,reps,weight,unit,deload,swapped_from',
      '2026-03-02,Push,"Press, chest",Machine,1,10,100,lb,true,',
      '2026-03-02,Push,"Press, chest",Machine,2,9,100,lb,true,',
      '',
    ]);
  });
});
