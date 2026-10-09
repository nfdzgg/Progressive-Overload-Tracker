import {
  emptyCycle,
  resolveCycleOnOpen,
  restartToday,
  scheduleRestartOnMonday,
  setCycleItems,
  startNextWorkout,
  startNow,
  trainAnyway,
  type CycleItem,
  type CycleState,
  type ISODate,
} from '../domain';
import { db } from './db';

export async function getCycle(today: ISODate): Promise<CycleState> {
  const row = await db.cycle.get('cycle');
  if (!row) return emptyCycle(today);
  const { id: _id, ...state } = row;
  return state;
}

export async function saveCycle(state: CycleState): Promise<void> {
  await db.cycle.put({ id: 'cycle', ...state });
}

async function update(today: ISODate, fn: (s: CycleState) => CycleState): Promise<CycleState> {
  return db.transaction('rw', db.cycle, async () => {
    const current = await getCycle(today);
    const next = fn(current);
    if (next !== current) await saveCycle(next);
    return next;
  });
}

/** Run on app open and when the date changes (scheduled restart, rest consumption). */
export function resolveCycleForToday(today: ISODate): Promise<CycleState> {
  return update(today, (s) => resolveCycleOnOpen(s, today));
}

/**
 * Replaces the cycle items (Settings). The pointer stays if still in range,
 * unless an explicit new pointer is given (e.g. to follow a moved item).
 */
export function saveCycleItems(
  items: CycleItem[],
  today: ISODate,
  pointer?: number,
): Promise<CycleState> {
  return update(today, (s) => {
    const next = setCycleItems(s, items);
    return pointer !== undefined && pointer >= 0 && pointer < items.length
      ? { ...next, pointer }
      : next;
  });
}

export const restartCycleToday = (today: ISODate) => update(today, (s) => restartToday(s, today));
export const restartCycleOnMonday = (today: ISODate) =>
  update(today, (s) => scheduleRestartOnMonday(s, today));
export const cancelRestartAndStartNow = (today: ISODate) =>
  update(today, (s) => startNow(s, today));
export const trainAnywayToday = (today: ISODate) => update(today, (s) => trainAnyway(s, today));
export const startNextWorkoutToday = (today: ISODate) =>
  update(today, (s) => startNextWorkout(s, today));
