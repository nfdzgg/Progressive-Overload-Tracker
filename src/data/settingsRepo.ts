import { DEFAULT_SETTINGS, type Settings } from '../domain';
import { db } from './db';

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings');
  if (!row) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...settings } = row;
  return settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch };
    await db.settings.put({ id: 'settings', ...next });
    return next;
  });
}

/** Records a successful export (shown in Settings → Data). */
export async function markExported(at: string = new Date().toISOString()): Promise<void> {
  await updateSettings({ lastExportAt: at });
}
