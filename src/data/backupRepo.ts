// Reading and replacing everything: first run, backup import/export, routine
// import/export, and wipe.
import { DEFAULT_SETTINGS, emptyCycle, newId, type ISODate, type Unit } from '../domain';
import {
  entriesToCsv,
  extractRoutine,
  mergeRoutine,
  normalizeBackupData,
  parseBackup,
  parseRoutine,
  serializeBackup,
  serializeRoutine,
  type BackupData,
  type RoutineMerge,
} from './backup';
import { getCycle } from './cycleRepo';
import { allTables, db } from './db';
import { buildPplTemplate } from './seed';
import { getSettings } from './settingsRepo';

/** Everything in the database, in a stable order. */
export async function readAllData(today: ISODate): Promise<BackupData> {
  return db.transaction('r', allTables(), async () =>
    normalizeBackupData({
      exercises: await db.exercises.toArray(),
      workouts: await db.workouts.toArray(),
      cycle: await getCycle(today),
      sessions: await db.sessions.toArray(),
      entries: await db.entries.toArray(),
      settings: await getSettings(),
    }),
  );
}

/** Replaces everything with `data` in one transaction. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
    await db.exercises.bulkAdd(data.exercises);
    await db.workouts.bulkAdd(data.workouts);
    await db.sessions.bulkAdd(data.sessions);
    await db.entries.bulkAdd(data.entries);
    await db.cycle.put({ id: 'cycle', ...data.cycle });
    await db.settings.put({ id: 'settings', ...data.settings });
  });
}

/** Deletes all data on this device. */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
  });
}

/** Full backup as JSON text. */
export async function exportBackupText(today: ISODate, now = new Date()): Promise<string> {
  return serializeBackup(await readAllData(today), now.toISOString());
}

/** Validates and imports a full backup, replacing everything. */
export async function importBackupText(text: string): Promise<BackupData> {
  const data = parseBackup(text);
  await replaceAllData(data);
  return data;
}

/** Logs as CSV (one row per logged set). */
export async function exportLogsCsv(today: ISODate): Promise<string> {
  return entriesToCsv(await readAllData(today));
}

/** Routine only (exercises, workouts, cycle) as JSON text; contains no logs. */
export async function exportRoutineText(today: ISODate, now = new Date()): Promise<string> {
  return serializeRoutine(extractRoutine(await readAllData(today)), now.toISOString());
}

/**
 * Imports a routine: exercises matched by name keep their history, unmatched
 * ones are created, and the cycle and workouts are replaced. The cycle starts
 * from its first item today.
 */
export async function importRoutineText(text: string, today: ISODate): Promise<RoutineMerge> {
  const routine = parseRoutine(text);
  return db.transaction('rw', [db.exercises, db.workouts, db.cycle], async () => {
    const merge = mergeRoutine(await db.exercises.toArray(), routine, newId);
    await db.exercises.bulkPut(merge.exercises);
    await db.workouts.clear();
    await db.workouts.bulkAdd(merge.workouts);
    await db.cycle.put({
      id: 'cycle',
      items: merge.cycleItems,
      pointer: 0,
      pointerSince: today,
      restartOn: null,
    });
    return merge;
  });
}

/** First run: the Push / Pull / Legs template or a blank start. Sets `onboarded`. */
export async function completeFirstRun(
  choice: 'template' | 'blank',
  unit: Unit,
  today: ISODate,
): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await db.exercises.clear();
    await db.workouts.clear();
    const cycle = emptyCycle(today);
    if (choice === 'template') {
      const routine = buildPplTemplate(newId);
      await db.exercises.bulkAdd(routine.exercises);
      await db.workouts.bulkAdd(routine.workouts);
      cycle.items = routine.cycleItems;
    }
    await db.cycle.put({ id: 'cycle', ...cycle });
    const settings = await getSettings();
    await db.settings.put({
      id: 'settings',
      ...DEFAULT_SETTINGS,
      ...settings,
      unit,
      onboarded: true,
    });
  });
}
