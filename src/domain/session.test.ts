import { describe, expect, it } from 'vitest';
import { entryForSlot, isSessionComplete, removeWorkoutFromCycle } from './session';
import { makeEntry, REST, W } from './test-helpers';

describe('session slots', () => {
  it("finds a slot's own entry", () => {
    const own = makeEntry({ id: 'own', exerciseId: 'press' });
    expect(entryForSlot([own], 'press')?.id).toBe('own');
    expect(entryForSlot([own], 'row')).toBeUndefined();
  });

  it('a swapped entry belongs to the slot it was swapped from', () => {
    const swapped = makeEntry({ id: 'sw', exerciseId: 'dips', swappedFromExerciseId: 'press' });
    expect(entryForSlot([swapped], 'press')?.id).toBe('sw');
    // The performed exercise is not a slot of its own here.
    expect(entryForSlot([swapped], 'dips')).toBeUndefined();
  });

  it('a session is complete when every slot is logged or skipped', () => {
    const entries = [
      makeEntry({ exerciseId: 'a', status: 'logged' }),
      makeEntry({ exerciseId: 'b', status: 'skipped' }),
    ];
    expect(isSessionComplete(['a', 'b'], entries)).toBe(true);
    expect(isSessionComplete(['a', 'b', 'c'], entries)).toBe(false);
    expect(isSessionComplete(['a'], [makeEntry({ exerciseId: 'a', status: 'draft' })])).toBe(false);
    expect(isSessionComplete([], [])).toBe(false);
  });
});

describe('removing a workout from the cycle', () => {
  it('drops its items and keeps the pointer on the same remaining item', () => {
    const state = {
      items: [W('push'), W('pull'), W('legs'), REST],
      pointer: 2,
      pointerSince: '2026-03-02',
      restartOn: null,
    };
    const next = removeWorkoutFromCycle(state, 'pull');
    expect(next.items).toEqual([W('push'), W('legs'), REST]);
    expect(next.pointer).toBe(1);
  });

  it('moves the pointer to the following item when its own item is removed', () => {
    const state = {
      items: [W('push'), W('pull'), REST],
      pointer: 1,
      pointerSince: '2026-03-02',
      restartOn: null,
    };
    expect(removeWorkoutFromCycle(state, 'pull')).toMatchObject({
      items: [W('push'), REST],
      pointer: 1,
    });
    const last = { ...state, pointer: 2, items: [W('push'), REST, W('pull')] };
    expect(removeWorkoutFromCycle(last, 'pull').pointer).toBe(0);
  });
});
