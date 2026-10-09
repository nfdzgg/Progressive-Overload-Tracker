// Pure helpers for editing the cycle in Settings. Moving or removing items
// keeps the pointer on the same item where possible, so "what's next" does
// not jump around while the user rearranges the cycle.
import type { CycleItem, Workout } from '../../domain';

export interface CycleEdit {
  items: CycleItem[];
  pointer: number;
}

/** Moves the element at `from` to `to` (new array; out-of-range moves are ignored). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Where the element at `index` ends up after moving `from` → `to`. */
export function followIndex(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < index && to >= index) return index - 1;
  if (from > index && to <= index) return index + 1;
  return index;
}

function inRange(pointer: number, length: number): number {
  return pointer >= 0 && pointer < length ? pointer : 0;
}

export function moveCycleItem(
  items: readonly CycleItem[],
  pointer: number,
  from: number,
  to: number,
): CycleEdit {
  const p = inRange(pointer, items.length);
  return { items: moveItem(items, from, to), pointer: followIndex(p, from, to) };
}

/**
 * Removing an item before the pointer keeps the pointer on its item; removing
 * the pointer's own item moves it to the following item (wrapping to the
 * first), the same rule the data layer uses when a workout is deleted.
 */
export function removeCycleItem(
  items: readonly CycleItem[],
  pointer: number,
  index: number,
): CycleEdit {
  const next = items.filter((_, i) => i !== index);
  const p = inRange(pointer, items.length);
  return { items: next, pointer: inRange(index < p ? p - 1 : p, next.length) };
}

/** New items go at the end; the pointer stays where it is. */
export function addCycleItem(
  items: readonly CycleItem[],
  pointer: number,
  item: CycleItem,
): CycleEdit {
  return { items: [...items, item], pointer: inRange(pointer, items.length) };
}

export function cycleItemLabel(item: CycleItem, workouts: readonly Workout[]): string {
  if (item.kind === 'rest') return 'Rest';
  return workouts.find((w) => w.id === item.workoutId)?.name ?? 'Missing workout';
}

/** "Push, Pull, Legs, Rest". */
export function cycleSummary(items: readonly CycleItem[], workouts: readonly Workout[]): string {
  return items.map((item) => cycleItemLabel(item, workouts)).join(', ');
}
