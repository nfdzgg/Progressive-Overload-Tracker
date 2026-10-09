import { describe, expect, it } from 'vitest';
import type { CycleItem, Workout } from '../../domain';
import {
  addCycleItem,
  cycleItemLabel,
  cycleSummary,
  followIndex,
  moveCycleItem,
  moveItem,
  removeCycleItem,
} from './cycleEdit';

const W = (workoutId: string): CycleItem => ({ kind: 'workout', workoutId });
const REST: CycleItem = { kind: 'rest' };
const PPL = [W('push'), W('pull'), W('legs'), REST];

describe('moveItem', () => {
  it('moves an element and leaves the input untouched', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b'], 0, 2)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('followIndex', () => {
  it('follows the moved element itself', () => {
    expect(followIndex(1, 1, 3)).toBe(3);
    expect(followIndex(3, 3, 0)).toBe(0);
  });

  it('shifts elements the move passes over', () => {
    // Moving index 0 down past index 2: index 2 shifts up to 1.
    expect(followIndex(2, 0, 2)).toBe(1);
    // Moving index 3 up to 1: index 1 shifts down to 2.
    expect(followIndex(1, 3, 1)).toBe(2);
  });

  it('leaves elements outside the move alone', () => {
    expect(followIndex(0, 2, 3)).toBe(0);
    expect(followIndex(3, 0, 1)).toBe(3);
  });
});

describe('moveCycleItem keeps the pointer on the same item', () => {
  it('when the pointer item itself moves', () => {
    const next = moveCycleItem(PPL, 1, 1, 2);
    expect(next.items).toEqual([W('push'), W('legs'), W('pull'), REST]);
    expect(next.items[next.pointer]).toEqual(W('pull'));
  });

  it('when another item moves across the pointer', () => {
    const down = moveCycleItem(PPL, 1, 0, 1);
    expect(down.items[down.pointer]).toEqual(W('pull'));
    expect(down.pointer).toBe(0);
    const up = moveCycleItem(PPL, 1, 2, 1);
    expect(up.items[up.pointer]).toEqual(W('pull'));
    expect(up.pointer).toBe(2);
  });

  it('when an item moves elsewhere', () => {
    const next = moveCycleItem(PPL, 0, 2, 3);
    expect(next.pointer).toBe(0);
    expect(next.items).toEqual([W('push'), W('pull'), REST, W('legs')]);
  });
});

describe('removeCycleItem', () => {
  it('keeps the pointer on its item when an earlier item is removed', () => {
    const next = removeCycleItem(PPL, 2, 0);
    expect(next.items).toEqual([W('pull'), W('legs'), REST]);
    expect(next.items[next.pointer]).toEqual(W('legs'));
  });

  it('keeps the pointer index when a later item is removed', () => {
    expect(removeCycleItem(PPL, 1, 3)).toEqual({
      items: [W('push'), W('pull'), W('legs')],
      pointer: 1,
    });
  });

  it("moves to the following item when the pointer's own item is removed", () => {
    const next = removeCycleItem(PPL, 1, 1);
    expect(next.items[next.pointer]).toEqual(W('legs'));
  });

  it('wraps to the first item when the last item under the pointer is removed', () => {
    expect(removeCycleItem(PPL, 3, 3).pointer).toBe(0);
  });

  it('resets to 0 when the cycle becomes empty', () => {
    expect(removeCycleItem([REST], 0, 0)).toEqual({ items: [], pointer: 0 });
  });

  it('treats an out-of-range pointer as the first item', () => {
    expect(removeCycleItem(PPL, 9, 3).pointer).toBe(0);
  });
});

describe('addCycleItem', () => {
  it('appends and keeps the pointer', () => {
    expect(addCycleItem(PPL, 2, REST)).toEqual({ items: [...PPL, REST], pointer: 2 });
  });

  it('starts at the first item of an empty cycle', () => {
    expect(addCycleItem([], 3, W('push'))).toEqual({ items: [W('push')], pointer: 0 });
  });
});

describe('labels', () => {
  const workouts: Workout[] = [
    { id: 'push', name: 'Push', exerciseIds: [] },
    { id: 'pull', name: 'Pull', exerciseIds: [] },
  ];

  it('names workout and rest items', () => {
    expect(cycleItemLabel(W('push'), workouts)).toBe('Push');
    expect(cycleItemLabel(REST, workouts)).toBe('Rest');
    expect(cycleItemLabel(W('gone'), workouts)).toBe('Missing workout');
  });

  it('summarizes the cycle in order', () => {
    expect(cycleSummary([W('push'), W('pull'), REST], workouts)).toBe('Push, Pull, Rest');
    expect(cycleSummary([], workouts)).toBe('');
  });
});
