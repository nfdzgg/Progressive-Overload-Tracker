// Extension points for Session extras (S6): it plugs notes, the more menu,
// the Deload badge, and the rest timer into Today without editing this folder.
import { useSyncExternalStore, type ComponentType } from 'react';
import type { Exercise, LogEntry, PrKind, Session, Variant } from '../../domain';

export interface TodayCardContext {
  /** null until the first interaction creates the session. */
  session: Session | null;
  workoutId: string;
  /** The workout's exercise this card stands for. */
  slotExerciseId: string;
  /** The exercise actually performed (differs from the slot after a swap). */
  exercise: Exercise;
  /** The variant currently selected on the card. */
  variant: Variant;
  /** This slot's entry, if any. */
  entry: LogEntry | undefined;
  /** Returns the session, creating it if needed. */
  ensureSession: () => Promise<Session>;
}

export interface SetCommittedEvent {
  exercise: Exercise;
  setIndex: number;
  restSeconds: number;
}

export interface EntryLoggedEvent {
  exercise: Exercise;
  entry: LogEntry;
  restSeconds: number;
  prs: PrKind[];
}

export interface TodayExtensions {
  /** Rendered at the right of every card header (active and done cards): notes and more icons. */
  CardHeaderActions?: ComponentType<TodayCardContext>;
  /** Rendered next to the Today title (the Deload badge). Gets the current session or null. */
  TopBarAccessory?: ComponentType<{ session: Session | null }>;
  /** A reps field for any set other than the last was filled and lost focus. */
  onSetCommitted?: (event: SetCommittedEvent) => void;
  /** Log was pressed and the entry was saved. */
  onEntryLogged?: (event: EntryLoggedEvent) => void;
}

let current: TodayExtensions = {};
const listeners = new Set<() => void>();

/** Merges extensions (called by S6 at module load). */
export function registerTodayExtensions(extensions: TodayExtensions): void {
  current = { ...current, ...extensions };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): TodayExtensions => current;

/** Current extensions (for Today's components). */
export function useTodayExtensions(): TodayExtensions {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
