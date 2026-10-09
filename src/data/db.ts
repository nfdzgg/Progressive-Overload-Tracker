import Dexie, { type Table } from 'dexie';
import type { CycleState, Exercise, LogEntry, Session, Settings, Workout } from '../domain';

/** Version of the stored data shape. Backups carry it as `schemaVersion`. */
export const SCHEMA_VERSION = 1;

export const DB_NAME = 'progressive-overload-tracker';

export type SettingsRow = Settings & { id: 'settings' };
export type CycleRow = CycleState & { id: 'cycle' };

export class OverloadDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  sessions!: Table<Session, string>;
  entries!: Table<LogEntry, string>;
  settings!: Table<SettingsRow, string>;
  cycle!: Table<CycleRow, string>;

  constructor(name = DB_NAME) {
    super(name);
    // Every schema change gets a new version here with an upgrade function,
    // plus a matching step in backup migrations (see migrations.ts).
    this.version(1).stores({
      exercises: 'id, name',
      workouts: 'id',
      sessions: 'id, date, status, workoutId',
      entries: 'id, sessionId, date, exerciseId, [exerciseId+variantId], status',
      settings: 'id',
      cycle: 'id',
    });
  }
}

/** The app's single database. */
export const db = new OverloadDB();

/** All tables, for transactions that touch everything. */
export function allTables() {
  return [db.exercises, db.workouts, db.sessions, db.entries, db.settings, db.cycle];
}
