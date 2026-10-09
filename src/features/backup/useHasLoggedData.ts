import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data';

/** Whether any entry has been logged (undefined while loading). */
export function useHasLoggedData(): boolean | undefined {
  return useLiveQuery(
    async () => (await db.entries.where('status').equals('logged').count()) > 0,
    [],
  );
}
