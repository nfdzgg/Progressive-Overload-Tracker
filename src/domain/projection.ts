// SPEC 5.2: future days are projected by walking the cycle from the pointer,
// one item per day. A preview only; never stored.
import { addDays, maxDate } from './dates';
import { currentItem, resolveCycleOnOpen } from './cycle';
import type { CycleItem, CycleState, ISODate } from './types';

export interface ProjectedDay {
  date: ISODate;
  item: CycleItem;
  /** True for days spent waiting for a scheduled restart (shown as rest). */
  waiting?: boolean;
}

/**
 * Projects from today (or tomorrow if today's session is finished, i.e.
 * `pointerSince` is in the future) through `until`, honoring `restartOn`.
 */
export function projectCycle(state: CycleState, today: ISODate, until: ISODate): ProjectedDay[] {
  if (state.items.length === 0) return [];
  let s = resolveCycleOnOpen(state, today);
  const days: ProjectedDay[] = [];
  let date = maxDate(today, s.pointerSince);
  let pointer = s.pointer;
  while (date <= until) {
    if (s.restartOn && date < s.restartOn) {
      days.push({ date, item: { kind: 'rest' }, waiting: true });
    } else {
      if (s.restartOn && date >= s.restartOn) {
        pointer = 0;
        s = { ...s, restartOn: null };
      }
      days.push({ date, item: currentItem({ ...s, pointer })! });
      pointer = (pointer + 1) % s.items.length;
    }
    date = addDays(date, 1);
  }
  return days;
}
