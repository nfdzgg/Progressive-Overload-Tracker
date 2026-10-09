import { describe, expect, it } from 'vitest';
import {
  advanceAfterFinish,
  currentItem,
  getTodayView,
  resolveCycleOnOpen,
  restartToday,
  scheduleRestartOnMonday,
  setCycleDay,
  setCycleItems,
  startNextWorkout,
  startNow,
  trainAnyway,
} from './cycle';
import { makeSession, REST, W } from './test-helpers';
import type { CycleState } from './types';

const PPL = [W('push'), W('pull'), W('legs'), W('push'), W('pull'), W('legs'), REST];

function state(overrides: Partial<CycleState> = {}): CycleState {
  return { items: PPL, pointer: 0, pointerSince: '2026-03-02', restartOn: null, ...overrides };
}

describe('cycle: today shows the item at the pointer', () => {
  it('returns the current item', () => {
    expect(currentItem(state({ pointer: 1 }))).toEqual(W('pull'));
    expect(currentItem(state({ items: [] }))).toBeNull();
  });
});

describe('cycle: finishing advances the pointer', () => {
  it('advances by one and sets pointerSince to the next calendar day', () => {
    const next = advanceAfterFinish(state({ pointer: 0 }), '2026-03-02');
    expect(next.pointer).toBe(1);
    expect(next.pointerSince).toBe('2026-03-03');
  });

  it('wraps around: the cycle repeats forever', () => {
    const next = advanceAfterFinish(state({ pointer: 6 }), '2026-03-08');
    expect(next.pointer).toBe(0);
  });
});

describe('cycle: missed days never skip a workout', () => {
  it('leaves the pointer on the same workout after several untrained days', () => {
    const s = state({ pointer: 1, pointerSince: '2026-03-03' });
    const resolved = resolveCycleOnOpen(s, '2026-03-10');
    expect(resolved.pointer).toBe(1);
    expect(resolved).toBe(s); // unchanged reference: nothing to persist
  });
});

describe('cycle: rest items consume exactly one calendar day', () => {
  it('stays on the rest item on its own day', () => {
    const s = state({ pointer: 6, pointerSince: '2026-03-08' });
    expect(resolveCycleOnOpen(s, '2026-03-08').pointer).toBe(6);
  });

  it('advances past the rest item on the next app open after its day', () => {
    const s = state({ pointer: 6, pointerSince: '2026-03-08' });
    const resolved = resolveCycleOnOpen(s, '2026-03-09');
    expect(resolved.pointer).toBe(0);
    expect(resolved.pointerSince).toBe('2026-03-09');
  });

  it('a long absence consumes a rest item only once', () => {
    const s = state({ pointer: 6, pointerSince: '2026-03-08' });
    const resolved = resolveCycleOnOpen(s, '2026-03-20');
    expect(resolved.pointer).toBe(0);
    expect(resolved.pointerSince).toBe('2026-03-09');
  });

  it('consecutive rest items each consume one day', () => {
    const s = state({
      items: [W('a'), REST, REST, W('b')],
      pointer: 1,
      pointerSince: '2026-03-01',
    });
    expect(resolveCycleOnOpen(s, '2026-03-02')).toMatchObject({
      pointer: 2,
      pointerSince: '2026-03-02',
    });
    expect(resolveCycleOnOpen(s, '2026-03-05')).toMatchObject({
      pointer: 3,
      pointerSince: '2026-03-03',
    });
  });

  it('a cycle of only rest items terminates', () => {
    const s = state({ items: [REST], pointer: 0, pointerSince: '2026-03-01' });
    const resolved = resolveCycleOnOpen(s, '2026-03-04');
    expect(resolved.pointer).toBe(0);
    expect(resolved.pointerSince).toBe('2026-03-04');
  });

  it('a rest item reached by finishing waits until the next day', () => {
    // Finish Legs on Saturday: pointer -> rest, pointerSince Sunday.
    const afterFinish = advanceAfterFinish(state({ pointer: 5 }), '2026-03-07');
    expect(afterFinish).toMatchObject({ pointer: 6, pointerSince: '2026-03-08' });
    expect(resolveCycleOnOpen(afterFinish, '2026-03-07').pointer).toBe(6);
    expect(resolveCycleOnOpen(afterFinish, '2026-03-08').pointer).toBe(6);
    expect(resolveCycleOnOpen(afterFinish, '2026-03-09').pointer).toBe(0);
  });

  it('"Train anyway" advances past the rest item immediately', () => {
    const next = trainAnyway(state({ pointer: 6, pointerSince: '2026-03-08' }), '2026-03-08');
    expect(next).toMatchObject({ pointer: 0, pointerSince: '2026-03-08' });
  });

  it('"Train anyway" does nothing on a workout item', () => {
    const s = state({ pointer: 2 });
    expect(trainAnyway(s, '2026-03-08')).toBe(s);
  });
});

describe('cycle: restart', () => {
  it('"Restart today" sets pointer to 0 now', () => {
    const next = restartToday(state({ pointer: 4, restartOn: '2026-03-09' }), '2026-03-04');
    expect(next).toEqual({ ...state(), pointer: 0, pointerSince: '2026-03-04', restartOn: null });
  });

  it('"Restart on Monday" sets restartOn to the coming Monday', () => {
    const next = scheduleRestartOnMonday(state({ pointer: 4 }), '2026-03-04');
    expect(next.restartOn).toBe('2026-03-09');
    expect(next.pointer).toBe(4);
  });

  it('on a Monday, "Restart on Monday" means next Monday', () => {
    expect(scheduleRestartOnMonday(state(), '2026-03-02').restartOn).toBe('2026-03-09');
  });

  it('before restartOn nothing changes; on restartOn the pointer resets and restartOn clears', () => {
    const s = state({ pointer: 4, pointerSince: '2026-03-04', restartOn: '2026-03-09' });
    expect(resolveCycleOnOpen(s, '2026-03-08')).toBe(s);
    expect(resolveCycleOnOpen(s, '2026-03-09')).toMatchObject({
      pointer: 0,
      pointerSince: '2026-03-09',
      restartOn: null,
    });
  });

  it('a scheduled restart still applies when the app is first opened after restartOn', () => {
    const s = state({ pointer: 4, pointerSince: '2026-03-04', restartOn: '2026-03-09' });
    expect(resolveCycleOnOpen(s, '2026-03-11')).toMatchObject({
      pointer: 0,
      pointerSince: '2026-03-09',
      restartOn: null,
    });
  });

  it('"Start now" cancels the wait and restarts immediately', () => {
    const next = startNow(state({ pointer: 4, restartOn: '2026-03-09' }), '2026-03-05');
    expect(next).toMatchObject({ pointer: 0, pointerSince: '2026-03-05', restartOn: null });
  });
});

describe('cycle: choosing which day of the cycle is today (joining mid-cycle)', () => {
  const friday = '2026-03-06';

  it('puts the pointer on the chosen item, available today', () => {
    const next = setCycleDay(state({ pointer: 0, pointerSince: '2026-03-02' }), 1, friday);
    expect(next.pointer).toBe(1);
    expect(next.pointerSince).toBe(friday);
    expect(getTodayView(next, [], friday)).toEqual({ kind: 'workout', workoutId: 'pull' });
  });

  it('continues in order from the chosen item after finishing', () => {
    const next = advanceAfterFinish(setCycleDay(state(), 1, friday), friday);
    expect(currentItem(next)).toEqual(W('legs'));
    expect(next.pointerSince).toBe('2026-03-07');
  });

  it("makes the chosen workout available again after today's workout was finished", () => {
    const finished = state({ pointer: 1, pointerSince: '2026-03-07' });
    const next = setCycleDay(finished, 4, friday);
    expect(getTodayView(next, [], friday)).toEqual({ kind: 'workout', workoutId: 'pull' });
  });

  it('cancels a scheduled restart', () => {
    const next = setCycleDay(state({ restartOn: '2026-03-09' }), 2, friday);
    expect(next.restartOn).toBeNull();
    expect(getTodayView(next, [], friday)).toEqual({ kind: 'workout', workoutId: 'legs' });
  });

  it('choosing a rest item makes today a rest day that is consumed tomorrow', () => {
    const next = setCycleDay(state(), 6, friday);
    expect(getTodayView(next, [], friday)).toEqual({ kind: 'rest' });
    expect(currentItem(resolveCycleOnOpen(next, '2026-03-07'))).toEqual(W('push'));
  });

  it('ignores an index outside the cycle', () => {
    const s = state({ pointer: 3 });
    expect(setCycleDay(s, 7, friday)).toBe(s);
    expect(setCycleDay(s, -1, friday)).toBe(s);
  });
});

describe('cycle: start next workout (second session)', () => {
  it('moves to the next workout item, skipping rest, and makes it available today', () => {
    const s = state({ pointer: 6, pointerSince: '2026-03-09' });
    expect(startNextWorkout(s, '2026-03-08')).toMatchObject({
      pointer: 0,
      pointerSince: '2026-03-08',
    });
  });

  it('keeps a workout pointer and only moves pointerSince to today', () => {
    const s = state({ pointer: 1, pointerSince: '2026-03-03' });
    expect(startNextWorkout(s, '2026-03-02')).toMatchObject({
      pointer: 1,
      pointerSince: '2026-03-02',
    });
  });

  it('does nothing when the cycle has no workouts', () => {
    const s = state({ items: [REST], pointer: 0 });
    expect(startNextWorkout(s, '2026-03-02')).toBe(s);
  });
});

describe('cycle: editing items', () => {
  it('keeps the pointer when it is still in range and clamps it otherwise', () => {
    expect(setCycleItems(state({ pointer: 2 }), [W('a'), W('b'), W('c')]).pointer).toBe(2);
    expect(setCycleItems(state({ pointer: 5 }), [W('a'), W('b')]).pointer).toBe(0);
    expect(setCycleItems(state({ pointer: 5 }), []).pointer).toBe(0);
  });
});

describe('getTodayView', () => {
  const today = '2026-03-04';

  it('resumes an in-progress session from an earlier date instead of discarding it', () => {
    const old = makeSession({ id: 'old', date: '2026-03-01', status: 'inProgress' });
    expect(getTodayView(state({ pointer: 1 }), [old], today)).toEqual({
      kind: 'session',
      sessionId: 'old',
    });
  });

  it('shows the workout at the pointer when nothing is in progress', () => {
    expect(getTodayView(state({ pointer: 1 }), [], today)).toEqual({
      kind: 'workout',
      workoutId: 'pull',
    });
  });

  it('shows the rest day on a rest item', () => {
    expect(getTodayView(state({ pointer: 6, pointerSince: today }), [], today)).toEqual({
      kind: 'rest',
    });
  });

  it('after finishing, shows the finished summary for the rest of the day', () => {
    const done = makeSession({ id: 'done', date: today, status: 'finished', createdAt: 5 });
    const earlier = makeSession({ id: 'earlier', date: today, status: 'finished', createdAt: 1 });
    const s = state({ pointer: 2, pointerSince: '2026-03-05' });
    expect(getTodayView(s, [earlier, done], today)).toEqual({
      kind: 'finished',
      sessionId: 'done',
    });
  });

  it('shows the waiting-for-restart state until restartOn', () => {
    const s = state({ pointer: 3, restartOn: '2026-03-09' });
    expect(getTodayView(s, [], today)).toEqual({ kind: 'waitingRestart', restartOn: '2026-03-09' });
  });

  it('shows an empty state when the cycle has no items', () => {
    expect(getTodayView(state({ items: [] }), [], today)).toEqual({ kind: 'empty' });
  });
});
