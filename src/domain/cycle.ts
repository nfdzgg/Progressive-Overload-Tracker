// SPEC 5.1: the cycle is a rotating queue. All functions are pure and return
// the same object when nothing changes, so callers can skip writes.
import { addDays, nextMonday } from './dates';
import type { CycleItem, CycleState, ISODate, Session } from './types';

export function emptyCycle(today: ISODate): CycleState {
  return { items: [], pointer: 0, pointerSince: today, restartOn: null };
}

/** The item Today shows (the one at the pointer). */
export function currentItem(state: CycleState): CycleItem | null {
  return state.items[state.pointer] ?? null;
}

function step(state: CycleState): number {
  return state.items.length === 0 ? 0 : (state.pointer + 1) % state.items.length;
}

/**
 * Applied on app open (and when the date changes):
 * 1. On or after `restartOn`, set pointer = 0 and clear it.
 * 2. A rest item consumes exactly one calendar day: while the pointer is on a
 *    rest item and today is later than `pointerSince`, advance past it.
 * Missed days never skip a workout: a workout item stays put.
 */
export function resolveCycleOnOpen(state: CycleState, today: ISODate): CycleState {
  let next = state;
  if (next.restartOn && today >= next.restartOn) {
    next = { ...next, pointer: 0, pointerSince: next.restartOn, restartOn: null };
  }
  while (next.items.length > 0 && currentItem(next)?.kind === 'rest' && today > next.pointerSince) {
    next = { ...next, pointer: step(next), pointerSince: addDays(next.pointerSince, 1) };
  }
  return next;
}

/** Finishing a workout advances the pointer by one; it arrives tomorrow. */
export function advanceAfterFinish(state: CycleState, today: ISODate): CycleState {
  if (state.items.length === 0) return state;
  return { ...state, pointer: step(state), pointerSince: addDays(today, 1) };
}

/** Rest day "Train anyway": advance past the rest item immediately. */
export function trainAnyway(state: CycleState, today: ISODate): CycleState {
  if (currentItem(state)?.kind !== 'rest') return state;
  return { ...state, pointer: step(state), pointerSince: today };
}

/** Settings "Restart today": pointer = 0 now. */
export function restartToday(state: CycleState, today: ISODate): CycleState {
  return { ...state, pointer: 0, pointerSince: today, restartOn: null };
}

/** Settings "Restart on Monday": waits until the coming Monday. */
export function scheduleRestartOnMonday(state: CycleState, today: ISODate): CycleState {
  return { ...state, restartOn: nextMonday(today) };
}

/** Waiting state "Start now": cancels the wait and restarts immediately. */
export function startNow(state: CycleState, today: ISODate): CycleState {
  return restartToday(state, today);
}

/**
 * Finished summary "Start next workout": moves to the next workout item
 * (skipping rest items) and makes it available today.
 */
export function startNextWorkout(state: CycleState, today: ISODate): CycleState {
  if (!state.items.some((item) => item.kind === 'workout')) return state;
  let pointer = state.pointer;
  while (state.items[pointer]?.kind !== 'workout') pointer = (pointer + 1) % state.items.length;
  return { ...state, pointer, pointerSince: today };
}

/** Replaces the items; the pointer stays if still in range, otherwise resets to 0. */
export function setCycleItems(state: CycleState, items: CycleItem[]): CycleState {
  const pointer = state.pointer < items.length ? state.pointer : 0;
  return { ...state, items, pointer };
}

export type TodayView =
  /** No cycle items yet. */
  | { kind: 'empty' }
  /** Resume an in-progress session (from today or an earlier date). */
  | { kind: 'session'; sessionId: string }
  /** A restart is scheduled; until then Today shows a rest state with "Start now". */
  | { kind: 'waitingRestart'; restartOn: ISODate }
  /** Today's workout is done: compact summary plus "Start next workout". */
  | { kind: 'finished'; sessionId: string | null }
  /** The pointer is on a rest item: rest day with "Train anyway". */
  | { kind: 'rest' }
  /** The workout at the pointer, not started yet. */
  | { kind: 'workout'; workoutId: string };

function latest(sessions: Session[]): Session | undefined {
  return [...sessions].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  )[0];
}

/**
 * What Today shows. Expects a state already passed through
 * `resolveCycleOnOpen` for today.
 */
export function getTodayView(state: CycleState, sessions: Session[], today: ISODate): TodayView {
  const inProgress = latest(sessions.filter((s) => s.status === 'inProgress'));
  if (inProgress) return { kind: 'session', sessionId: inProgress.id };
  if (state.items.length === 0) return { kind: 'empty' };
  if (state.restartOn && today < state.restartOn) {
    return { kind: 'waitingRestart', restartOn: state.restartOn };
  }
  if (state.pointerSince > today) {
    const finished = latest(sessions.filter((s) => s.status === 'finished'));
    return { kind: 'finished', sessionId: finished?.id ?? null };
  }
  const item = currentItem(state);
  if (!item || item.kind === 'rest') return { kind: 'rest' };
  return { kind: 'workout', workoutId: item.workoutId };
}
