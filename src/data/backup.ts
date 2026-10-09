// Backup files: full backup (everything) and routine-only (no logs), plus
// CSV export of logs. Pure functions; the repositories read and write the db.
import {
  DEFAULT_SETTINGS,
  isISODate,
  type CycleItem,
  type CycleState,
  type Exercise,
  type ExerciseType,
  type LogEntry,
  type MuscleGroup,
  type Session,
  type Settings,
  type Workout,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
} from '../domain';
import { SCHEMA_VERSION } from './db';
import { migrateData, type RawData } from './migrations';

export const BACKUP_APP = 'progressive-overload-tracker';

export interface BackupData {
  exercises: Exercise[];
  workouts: Workout[];
  cycle: CycleState;
  sessions: Session[];
  entries: LogEntry[];
  settings: Settings;
}

export interface RoutineData {
  exercises: Exercise[];
  workouts: Workout[];
  cycleItems: CycleItem[];
}

interface FileEnvelope<K extends string, D> {
  app: typeof BACKUP_APP;
  kind: K;
  schemaVersion: number;
  exportedAt: string;
  data: D;
}

export type BackupFile = FileEnvelope<'backup', BackupData>;
export type RoutineFile = FileEnvelope<'routine', RoutineData>;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

// ---------- validation ----------

function fail(path: string, expected: string): never {
  throw new BackupError(`Invalid file: ${path} should be ${expected}.`);
}

const isObj = (v: unknown): v is RawData =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: RawData, key: string, path: string): string {
  if (typeof o[key] !== 'string') fail(`${path}.${key}`, 'text');
  return o[key] as string;
}

function num(o: RawData, key: string, path: string): number {
  if (typeof o[key] !== 'number' || !Number.isFinite(o[key])) fail(`${path}.${key}`, 'a number');
  return o[key] as number;
}

function numOrNull(o: RawData, key: string, path: string): number | null {
  if (o[key] === null || o[key] === undefined) return null;
  return num(o, key, path);
}

function bool(o: RawData, key: string, path: string): boolean {
  if (typeof o[key] !== 'boolean') fail(`${path}.${key}`, 'true or false');
  return o[key] as boolean;
}

function date(o: RawData, key: string, path: string): string {
  const v = str(o, key, path);
  if (!isISODate(v)) fail(`${path}.${key}`, 'a YYYY-MM-DD date');
  return v;
}

function oneOf<T extends string>(o: RawData, key: string, path: string, values: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !values.includes(v as T))
    fail(`${path}.${key}`, values.join(' or '));
  return v as T;
}

function arr(o: RawData, key: string, path: string): unknown[] {
  if (!Array.isArray(o[key])) fail(`${path}.${key}`, 'a list');
  return o[key] as unknown[];
}

function obj(v: unknown, path: string): RawData {
  if (!isObj(v)) fail(path, 'an object');
  return v;
}

function parseExercise(v: unknown, path: string): Exercise {
  const o = obj(v, path);
  const variants = arr(o, 'variants', path).map((raw, i) => {
    const vo = obj(raw, `${path}.variants[${i}]`);
    const vp = `${path}.variants[${i}]`;
    return {
      id: str(vo, 'id', vp),
      name: str(vo, 'name', vp),
      note: typeof vo.note === 'string' ? vo.note : '',
      archived: vo.archived === undefined ? false : bool(vo, 'archived', vp),
    };
  });
  if (variants.length === 0) fail(`${path}.variants`, 'a list with at least one variant');
  const defaultVariantId = str(o, 'defaultVariantId', path);
  if (!variants.some((x) => x.id === defaultVariantId)) {
    fail(`${path}.defaultVariantId`, 'the id of one of its variants');
  }
  return {
    id: str(o, 'id', path),
    name: str(o, 'name', path),
    type: oneOf<ExerciseType>(o, 'type', path, EXERCISE_TYPES),
    muscleGroup: oneOf<MuscleGroup>(o, 'muscleGroup', path, MUSCLE_GROUPS),
    sets: num(o, 'sets', path),
    repMin: num(o, 'repMin', path),
    repMax: num(o, 'repMax', path),
    restSeconds: num(o, 'restSeconds', path),
    variants,
    defaultVariantId,
    perSetWeight: o.perSetWeight === undefined ? false : bool(o, 'perSetWeight', path),
    archived: o.archived === undefined ? false : bool(o, 'archived', path),
  };
}

function parseWorkout(v: unknown, path: string): Workout {
  const o = obj(v, path);
  const exerciseIds = arr(o, 'exerciseIds', path).map((id, i) => {
    if (typeof id !== 'string') fail(`${path}.exerciseIds[${i}]`, 'text');
    return id;
  });
  return { id: str(o, 'id', path), name: str(o, 'name', path), exerciseIds };
}

function parseCycleItem(v: unknown, path: string): CycleItem {
  const o = obj(v, path);
  const kind = oneOf(o, 'kind', path, ['workout', 'rest'] as const);
  return kind === 'rest' ? { kind } : { kind, workoutId: str(o, 'workoutId', path) };
}

function parseCycle(v: unknown, path: string): CycleState {
  const o = obj(v, path);
  const items = arr(o, 'items', path).map((item, i) => parseCycleItem(item, `${path}.items[${i}]`));
  const pointer = num(o, 'pointer', path);
  return {
    items,
    pointer:
      Number.isInteger(pointer) && pointer >= 0 && pointer < Math.max(1, items.length)
        ? pointer
        : 0,
    pointerSince: date(o, 'pointerSince', path),
    restartOn:
      o.restartOn === null || o.restartOn === undefined ? null : date(o, 'restartOn', path),
  };
}

function parseSession(v: unknown, path: string): Session {
  const o = obj(v, path);
  return {
    id: str(o, 'id', path),
    date: date(o, 'date', path),
    workoutId: str(o, 'workoutId', path),
    workoutName: str(o, 'workoutName', path),
    deload: bool(o, 'deload', path),
    status: oneOf(o, 'status', path, ['inProgress', 'finished'] as const),
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
  };
}

function parseEntry(v: unknown, path: string): LogEntry {
  const o = obj(v, path);
  const sets = arr(o, 'sets', path).map((raw, i) => {
    const so = obj(raw, `${path}.sets[${i}]`);
    return {
      reps: numOrNull(so, 'reps', `${path}.sets[${i}]`),
      weight: numOrNull(so, 'weight', `${path}.sets[${i}]`),
    };
  });
  return {
    id: str(o, 'id', path),
    sessionId: str(o, 'sessionId', path),
    date: date(o, 'date', path),
    exerciseId: str(o, 'exerciseId', path),
    variantId: str(o, 'variantId', path),
    unit: oneOf(o, 'unit', path, ['lb', 'kg'] as const),
    weight: numOrNull(o, 'weight', path),
    sets,
    status: oneOf(o, 'status', path, ['draft', 'logged', 'skipped'] as const),
    swappedFromExerciseId:
      o.swappedFromExerciseId === null || o.swappedFromExerciseId === undefined
        ? null
        : str(o, 'swappedFromExerciseId', path),
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0,
  };
}

function parseSettings(v: unknown, path: string): Settings {
  const o = obj(v, path);
  return {
    unit: oneOf(o, 'unit', path, ['lb', 'kg'] as const),
    restTimerEnabled:
      o.restTimerEnabled === undefined
        ? DEFAULT_SETTINGS.restTimerEnabled
        : bool(o, 'restTimerEnabled', path),
    restTimerSound:
      o.restTimerSound === undefined
        ? DEFAULT_SETTINGS.restTimerSound
        : bool(o, 'restTimerSound', path),
    lastExportAt: typeof o.lastExportAt === 'string' ? o.lastExportAt : null,
    onboarded: o.onboarded === undefined ? true : bool(o, 'onboarded', path),
  };
}

function readEnvelope(text: string, kind: 'backup' | 'routine'): RawData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not valid JSON.');
  }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP) {
    throw new BackupError('This is not a Progressive Overload Tracker file.');
  }
  if (parsed.kind !== kind) {
    throw new BackupError(
      kind === 'backup'
        ? 'This is a routine file, not a full backup. Use "Import routine" instead.'
        : 'This is a full backup, not a routine file. Use "Import backup" instead.',
    );
  }
  if (typeof parsed.schemaVersion !== 'number') fail('schemaVersion', 'a number');
  try {
    return migrateData(obj(parsed.data, 'data'), parsed.schemaVersion);
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError((error as Error).message);
  }
}

// ---------- serialize / parse ----------

const byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Records in a stable order, so equal data serializes identically. */
export function normalizeBackupData(data: BackupData): BackupData {
  return {
    exercises: byId(data.exercises),
    workouts: byId(data.workouts),
    cycle: data.cycle,
    sessions: byId(data.sessions),
    entries: byId(data.entries),
    settings: data.settings,
  };
}

export function serializeBackup(data: BackupData, exportedAt: string): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    kind: 'backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    data: normalizeBackupData(data),
  };
  return JSON.stringify(file, null, 2);
}

/** Validates and migrates a full backup. Throws BackupError with a readable message. */
export function parseBackup(text: string): BackupData {
  const data = readEnvelope(text, 'backup');
  return normalizeBackupData({
    exercises: arr(data, 'exercises', 'data').map((v, i) => parseExercise(v, `exercises[${i}]`)),
    workouts: arr(data, 'workouts', 'data').map((v, i) => parseWorkout(v, `workouts[${i}]`)),
    cycle: parseCycle(data.cycle, 'cycle'),
    sessions: arr(data, 'sessions', 'data').map((v, i) => parseSession(v, `sessions[${i}]`)),
    entries: arr(data, 'entries', 'data').map((v, i) => parseEntry(v, `entries[${i}]`)),
    settings: parseSettings(data.settings, 'settings'),
  });
}

export function serializeRoutine(data: RoutineData, exportedAt: string): string {
  const file: RoutineFile = {
    app: BACKUP_APP,
    kind: 'routine',
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    data,
  };
  return JSON.stringify(file, null, 2);
}

export function parseRoutine(text: string): RoutineData {
  const data = readEnvelope(text, 'routine');
  const routine: RoutineData = {
    exercises: arr(data, 'exercises', 'data').map((v, i) => parseExercise(v, `exercises[${i}]`)),
    workouts: arr(data, 'workouts', 'data').map((v, i) => parseWorkout(v, `workouts[${i}]`)),
    cycleItems: arr(data, 'cycleItems', 'data').map((v, i) =>
      parseCycleItem(v, `cycleItems[${i}]`),
    ),
  };
  const exerciseIds = new Set(routine.exercises.map((e) => e.id));
  const workoutIds = new Set(routine.workouts.map((w) => w.id));
  routine.workouts.forEach((w, i) =>
    w.exerciseIds.forEach((id) => {
      if (!exerciseIds.has(id)) fail(`workouts[${i}].exerciseIds`, 'ids of exercises in the file');
    }),
  );
  routine.cycleItems.forEach((item, i) => {
    if (item.kind === 'workout' && !workoutIds.has(item.workoutId)) {
      fail(`cycleItems[${i}].workoutId`, 'the id of a workout in the file');
    }
  });
  return routine;
}

/**
 * The routine part of a library: active exercises with their active variants,
 * workouts, and cycle items. No logs, sessions, or settings.
 */
export function extractRoutine(
  data: Pick<BackupData, 'exercises' | 'workouts' | 'cycle'>,
): RoutineData {
  return {
    exercises: data.exercises
      .filter((e) => !e.archived)
      .map((e) => {
        const variants = e.variants.filter((v) => !v.archived);
        const defaultVariantId = variants.some((v) => v.id === e.defaultVariantId)
          ? e.defaultVariantId
          : variants[0].id;
        return { ...e, variants, defaultVariantId };
      }),
    workouts: data.workouts,
    cycleItems: data.cycle.items,
  };
}

// ---------- routine import ----------

export interface RoutineMerge {
  /** Exercises to write (updated matches and new ones). */
  exercises: Exercise[];
  workouts: Workout[];
  cycleItems: CycleItem[];
  matched: number;
  created: number;
}

const key = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Merges an imported routine into the library. Exercises are matched to
 * existing ones by name (case-insensitive) so their history is kept; matched
 * exercises take the file's settings and are unarchived, and their variants
 * are matched by name the same way. Unmatched exercises and variants are
 * created. Workouts and cycle items are replaced (new ids).
 */
export function mergeRoutine(
  existing: Exercise[],
  routine: RoutineData,
  newId: () => string,
): RoutineMerge {
  const idMap = new Map<string, string>();
  const out: Exercise[] = [];
  let matched = 0;
  let created = 0;
  for (const incoming of routine.exercises) {
    const candidates = existing.filter((e) => key(e.name) === key(incoming.name));
    const match = candidates.find((e) => !e.archived) ?? candidates[0];
    const variantIdMap = new Map<string, string>();
    if (match) {
      matched += 1;
      const variants = match.variants.map((v) => ({ ...v }));
      for (const iv of incoming.variants) {
        const existingVariant = variants.find((v) => key(v.name) === key(iv.name));
        if (existingVariant) {
          existingVariant.archived = false;
          if (iv.note) existingVariant.note = iv.note;
          variantIdMap.set(iv.id, existingVariant.id);
        } else {
          const id = newId();
          variants.push({ id, name: iv.name, note: iv.note, archived: false });
          variantIdMap.set(iv.id, id);
        }
      }
      idMap.set(incoming.id, match.id);
      out.push({
        ...match,
        type: incoming.type,
        muscleGroup: incoming.muscleGroup,
        sets: incoming.sets,
        repMin: incoming.repMin,
        repMax: incoming.repMax,
        restSeconds: incoming.restSeconds,
        perSetWeight: incoming.perSetWeight,
        archived: false,
        variants,
        defaultVariantId: variantIdMap.get(incoming.defaultVariantId) ?? match.defaultVariantId,
      });
    } else {
      created += 1;
      const id = newId();
      idMap.set(incoming.id, id);
      const variants = incoming.variants.map((v) => {
        const vid = newId();
        variantIdMap.set(v.id, vid);
        return { ...v, id: vid, archived: false };
      });
      out.push({
        ...incoming,
        id,
        archived: false,
        variants,
        defaultVariantId: variantIdMap.get(incoming.defaultVariantId) ?? variants[0].id,
      });
    }
  }
  const workoutIdMap = new Map<string, string>();
  const workouts = routine.workouts.map((w) => {
    const id = newId();
    workoutIdMap.set(w.id, id);
    return { id, name: w.name, exerciseIds: w.exerciseIds.map((e) => idMap.get(e)!) };
  });
  const cycleItems: CycleItem[] = routine.cycleItems.map((item) =>
    item.kind === 'rest' ? item : { kind: 'workout', workoutId: workoutIdMap.get(item.workoutId)! },
  );
  return { exercises: out, workouts, cycleItems, matched, created };
}

// ---------- CSV ----------

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_HEADER = [
  'date',
  'workout',
  'exercise',
  'variant',
  'set',
  'reps',
  'weight',
  'unit',
  'deload',
  'swapped_from',
];

/** One row per logged set: date, workout, exercise, variant, set, reps, weight, unit, deload. */
export function entriesToCsv(data: Pick<BackupData, 'entries' | 'sessions' | 'exercises'>): string {
  const sessions = new Map(data.sessions.map((s) => [s.id, s]));
  const exercises = new Map(data.exercises.map((e) => [e.id, e]));
  const logged = data.entries
    .filter((e) => e.status === 'logged')
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  const rows = [CSV_HEADER.join(',')];
  for (const entry of logged) {
    const session = sessions.get(entry.sessionId);
    const exercise = exercises.get(entry.exerciseId);
    const variant = exercise?.variants.find((v) => v.id === entry.variantId);
    const swappedFrom = entry.swappedFromExerciseId
      ? (exercises.get(entry.swappedFromExerciseId)?.name ?? '')
      : '';
    entry.sets.forEach((set, i) => {
      if (set.reps === null) return;
      rows.push(
        [
          entry.date,
          session?.workoutName ?? '',
          exercise?.name ?? '',
          variant?.name ?? '',
          i + 1,
          set.reps,
          set.weight ?? entry.weight,
          entry.unit,
          session?.deload ?? false,
          swappedFrom,
        ]
          .map(csvCell)
          .join(','),
      );
    });
  }
  return `${rows.join('\n')}\n`;
}
