// Backup migrations. Every schema change (a new Dexie version in db.ts) adds a
// step here that upgrades backup data from the previous version, so importing
// an older backup migrates it to the current shape.
import { SCHEMA_VERSION } from './db';

export type RawData = Record<string, unknown>;

/** `steps[n]` upgrades data from version n to n + 1. */
export type MigrationSteps = Record<number, (data: RawData) => RawData>;

export const BACKUP_MIGRATIONS: MigrationSteps = {
  // Version 1 is the first released schema; there is nothing older to upgrade.
};

export function migrateData(
  data: RawData,
  fromVersion: number,
  toVersion: number = SCHEMA_VERSION,
  steps: MigrationSteps = BACKUP_MIGRATIONS,
): RawData {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new Error(`Unknown schema version ${String(fromVersion)}`);
  }
  if (fromVersion > toVersion) {
    throw new Error(
      `This file was made by a newer version of the app (schema ${fromVersion}). Update the app first.`,
    );
  }
  let current = data;
  for (let v = fromVersion; v < toVersion; v += 1) {
    const step = steps[v];
    if (!step) throw new Error(`No migration from schema ${v} to ${v + 1}`);
    current = step(current);
  }
  return current;
}
