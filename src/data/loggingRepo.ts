// Sessions and log entries: drafts, Log, skip, swap, deload, finish, and
// editing past days. Finishing (explicitly or automatically when every slot is
// logged or skipped) advances the cycle pointer.
import {
  advanceAfterFinish,
  entryForSlot,
  isSessionComplete,
  newId,
  prsForLoggedEntry,
  type Exercise,
  type ISODate,
  type LogEntry,
  type PrKind,
  type Session,
  type SetLog,
  type Unit,
} from '../domain';
import { getCycle, saveCycle } from './cycleRepo';
import { db } from './db';

/** Ordered exercise ids of a session's workout that still exist and are active. */
export async function sessionSlots(session: Session): Promise<string[]> {
  const workout = await db.workouts.get(session.workoutId);
  if (!workout) return [];
  const exercises = await db.exercises.bulkGet(workout.exerciseIds);
  return workout.exerciseIds.filter((_, i) => exercises[i] && !exercises[i]!.archived);
}

/** The in-progress session, if any (there is at most one). */
export async function getInProgressSession(): Promise<Session | undefined> {
  const sessions = await db.sessions.where('status').equals('inProgress').toArray();
  return sessions.sort((a, b) => b.createdAt - a.createdAt)[0];
}

/**
 * Returns the in-progress session, or starts one for `workoutId` today.
 * Today calls this lazily on the first interaction so untouched days leave no
 * empty sessions behind.
 */
export async function ensureSession(workoutId: string, today: ISODate): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.workouts], async () => {
    const existing = await getInProgressSession();
    if (existing) return existing;
    const workout = await db.workouts.get(workoutId);
    if (!workout) throw new Error('Workout not found');
    const session: Session = {
      id: newId(),
      date: today,
      workoutId,
      workoutName: workout.name,
      deload: false,
      status: 'inProgress',
      createdAt: Date.now(),
    };
    await db.sessions.add(session);
    return session;
  });
}

export interface EntryInput {
  sessionId: string;
  /** The workout's exercise this card stands for. */
  slotExerciseId: string;
  /** The exercise actually performed (differs from the slot after a swap). */
  exerciseId: string;
  variantId: string;
  unit: Unit;
  /** null = bodyweight / no weight. */
  weight: number | null;
  sets: SetLog[];
}

async function upsertSlotEntry(input: EntryInput, status: LogEntry['status']): Promise<LogEntry> {
  const session = await db.sessions.get(input.sessionId);
  if (!session) throw new Error('Session not found');
  const entries = await db.entries.where('sessionId').equals(input.sessionId).toArray();
  const existing = entryForSlot(entries, input.slotExerciseId);
  const entry: LogEntry = {
    id: existing?.id ?? newId(),
    sessionId: input.sessionId,
    date: session.date,
    exerciseId: input.exerciseId,
    variantId: input.variantId,
    unit: input.unit,
    weight: input.weight,
    sets: input.sets,
    status,
    swappedFromExerciseId: input.exerciseId === input.slotExerciseId ? null : input.slotExerciseId,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await db.entries.put(entry);
  return entry;
}

/** Saves what has been typed so far as a draft, so closing the app loses nothing. */
export async function saveDraft(input: EntryInput): Promise<LogEntry> {
  return db.transaction('rw', [db.sessions, db.entries], () => upsertSlotEntry(input, 'draft'));
}

async function finishInternal(session: Session, today: ISODate): Promise<void> {
  const entries = await db.entries.where('sessionId').equals(session.id).toArray();
  for (const entry of entries) {
    if (entry.status === 'draft') await db.entries.update(entry.id, { status: 'skipped' });
  }
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  for (const slot of await sessionSlots(session)) {
    if (entryForSlot(entries, slot)) continue;
    const exercise = exercises.get(slot)!;
    await db.entries.add({
      id: newId(),
      sessionId: session.id,
      date: session.date,
      exerciseId: slot,
      variantId: exercise.defaultVariantId,
      unit: 'lb',
      weight: null,
      sets: [],
      status: 'skipped',
      swappedFromExerciseId: null,
      createdAt: Date.now(),
    });
  }
  await db.sessions.update(session.id, { status: 'finished' });
  await saveCycle(advanceAfterFinish(await getCycle(today), today));
}

const LOGGING_TABLES = () => [db.sessions, db.entries, db.workouts, db.exercises, db.cycle];

async function finishIfComplete(sessionId: string, today: ISODate): Promise<boolean> {
  const session = await db.sessions.get(sessionId);
  if (!session || session.status !== 'inProgress') return false;
  const entries = await db.entries.where('sessionId').equals(sessionId).toArray();
  if (!isSessionComplete(await sessionSlots(session), entries)) return false;
  await finishInternal(session, today);
  return true;
}

export interface LogResult {
  entry: LogEntry;
  /** PRs this entry set (empty in a deload session). */
  prs: PrKind[];
  /** True when this completed the workout and the session finished. */
  sessionFinished: boolean;
}

/** Log: marks the entry logged. Requires at least one set with reps. */
export async function logEntry(input: EntryInput, today: ISODate): Promise<LogResult> {
  if (!input.sets.some((s) => s.reps !== null && s.reps > 0)) {
    throw new Error('Enter reps for at least one set');
  }
  return db.transaction('rw', LOGGING_TABLES(), async () => {
    const entry = await upsertSlotEntry(input, 'logged');
    const prs = await prsForEntry(entry);
    const sessionFinished = await finishIfComplete(input.sessionId, today);
    return { entry, prs, sessionFinished };
  });
}

/** PR kinds for a logged entry against everything logged before it. */
export async function prsForEntry(entry: LogEntry): Promise<PrKind[]> {
  const exercise = await db.exercises.get(entry.exerciseId);
  if (!exercise) return [];
  const entries = await db.entries
    .where('[exerciseId+variantId]')
    .equals([entry.exerciseId, entry.variantId])
    .toArray();
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  return prsForLoggedEntry(entry, entries, sessions, exercise);
}

/** Reopens a done card for editing (back to draft until logged again). */
export async function reopenEntry(entryId: string): Promise<void> {
  await db.entries.update(entryId, { status: 'draft' });
}

/** "Skip for today" on a slot. */
export async function skipSlot(
  sessionId: string,
  slotExerciseId: string,
  today: ISODate,
): Promise<boolean> {
  return db.transaction('rw', LOGGING_TABLES(), async () => {
    const entries = await db.entries.where('sessionId').equals(sessionId).toArray();
    const existing = entryForSlot(entries, slotExerciseId);
    if (existing) {
      await db.entries.update(existing.id, { status: 'skipped' });
    } else {
      const exercise = await db.exercises.get(slotExerciseId);
      if (!exercise) throw new Error('Exercise not found');
      await upsertSlotEntry(
        {
          sessionId,
          slotExerciseId,
          exerciseId: slotExerciseId,
          variantId: exercise.defaultVariantId,
          unit: 'lb',
          weight: null,
          sets: [],
        },
        'skipped',
      );
    }
    return finishIfComplete(sessionId, today);
  });
}

/**
 * "Swap for today": the slot is performed as another exercise; the log is
 * recorded against the exercise actually performed. Swapping back to the
 * slot's own exercise undoes the swap.
 */
export async function swapSlot(
  sessionId: string,
  slotExerciseId: string,
  toExerciseId: string,
  unit: Unit,
): Promise<LogEntry | null> {
  return db.transaction('rw', [db.sessions, db.entries, db.exercises], async () => {
    const entries = await db.entries.where('sessionId').equals(sessionId).toArray();
    const existing = entryForSlot(entries, slotExerciseId);
    if (existing) await db.entries.delete(existing.id);
    if (toExerciseId === slotExerciseId) return null;
    const to: Exercise | undefined = await db.exercises.get(toExerciseId);
    if (!to) throw new Error('Exercise not found');
    return upsertSlotEntry(
      {
        sessionId,
        slotExerciseId,
        exerciseId: toExerciseId,
        variantId: to.defaultVariantId,
        unit,
        weight: null,
        sets: Array.from({ length: to.sets }, () => ({ reps: null, weight: null })),
      },
      'draft',
    );
  });
}

/** "Mark session as deload" (applies to the whole session). */
export async function setSessionDeload(sessionId: string, deload: boolean): Promise<void> {
  await db.sessions.update(sessionId, { deload });
}

/** "Finish workout": unlogged exercises become skipped; the pointer advances. */
export async function finishSession(sessionId: string, today: ISODate): Promise<void> {
  await db.transaction('rw', LOGGING_TABLES(), async () => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.status !== 'inProgress') return;
    await finishInternal(session, today);
  });
}

// ---------- past days (calendar) ----------

/**
 * Adds a finished session on a past day with no session, for logging after
 * the fact. Does not move the pointer.
 */
export async function createPastSession(date: ISODate, workoutId: string): Promise<Session> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) throw new Error('Workout not found');
  const session: Session = {
    id: newId(),
    date,
    workoutId,
    workoutName: workout.name,
    deload: false,
    status: 'finished',
    createdAt: Date.now(),
  };
  await db.sessions.add(session);
  return session;
}

export interface PastEntryInput {
  sessionId: string;
  exerciseId: string;
  variantId: string;
  unit: Unit;
  weight: number | null;
  sets: SetLog[];
}

/** Adds a logged entry to a past session. */
export async function addLoggedEntry(input: PastEntryInput): Promise<LogEntry> {
  const session = await db.sessions.get(input.sessionId);
  if (!session) throw new Error('Session not found');
  const entry: LogEntry = {
    id: newId(),
    ...input,
    date: session.date,
    status: 'logged',
    swappedFromExerciseId: null,
    createdAt: Date.now(),
  };
  await db.entries.add(entry);
  return entry;
}

export type EntryPatch = Partial<
  Pick<LogEntry, 'variantId' | 'unit' | 'weight' | 'sets' | 'status'>
>;

export async function updateEntry(entryId: string, patch: EntryPatch): Promise<void> {
  await db.entries.update(entryId, patch);
}

export async function deleteEntry(entryId: string): Promise<void> {
  await db.entries.delete(entryId);
}

/** Deletes a session and all its entries. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.entries], async () => {
    await db.entries.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}
