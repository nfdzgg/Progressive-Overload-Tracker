import { useCallback, useMemo, useRef, useState } from 'react';
import { ensureSession as ensureSessionFor, finishSession } from '../../data';
import { entryForSlot, type ISODate, type Session } from '../../domain';
import { Button, ConfirmDialog, EmptyState, Screen, Stack } from '../../ui';
import { ExerciseCard } from './ExerciseCard';
import { useTodayExtensions } from './extensions';
import { pendingSlotCount, slotIds } from './todayModel';
import type { TodayData } from './useTodayData';

export interface WorkoutViewProps {
  data: TodayData;
  workoutId: string;
  /** The in-progress session, or null before the first interaction. */
  session: Session | null;
  title: string;
}

/**
 * Returns the session, creating it on first use. Untouched days leave no
 * empty session behind.
 */
function useEnsureSession(workoutId: string, session: Session | null, today: ISODate) {
  const pending = useRef<Promise<Session> | null>(null);
  return useCallback(async () => {
    if (session?.status === 'inProgress') return session;
    pending.current ??= ensureSessionFor(workoutId, today).catch((error: unknown) => {
      pending.current = null;
      throw error;
    });
    return pending.current;
  }, [session, workoutId, today]);
}

/** The workout's cards in order, then Finish workout. */
export function WorkoutView({ data, workoutId, session, title }: WorkoutViewProps) {
  const { TopBarAccessory } = useTodayExtensions();
  const ensureSession = useEnsureSession(workoutId, session, data.today);
  const [confirming, setConfirming] = useState(false);

  const sessionId = session?.id;
  const sessionEntries = useMemo(
    () => (sessionId ? data.entries.filter((e) => e.sessionId === sessionId) : []),
    [data.entries, sessionId],
  );
  const slots = slotIds(data.workoutsById.get(workoutId), data.exercisesById, sessionEntries);
  const pending = pendingSlotCount(slots, sessionEntries);

  async function finish() {
    setConfirming(false);
    const current = await ensureSession();
    await finishSession(current.id, data.today);
  }

  return (
    <Screen
      title={title}
      accessory={TopBarAccessory ? <TopBarAccessory session={session} /> : undefined}
    >
      <Stack gap="lg">
        {slots.length > 0 ? (
          <Stack gap="sm">
            {slots.map((slot) => (
              <ExerciseCard
                key={slot}
                data={data}
                workoutId={workoutId}
                session={session}
                slotExerciseId={slot}
                entry={entryForSlot(sessionEntries, slot)}
                ensureSession={ensureSession}
              />
            ))}
          </Stack>
        ) : (
          <EmptyState
            title="No exercises in this workout"
            message="Add exercises to it in Settings."
          />
        )}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => (pending > 0 ? setConfirming(true) : void finish())}
        >
          Finish workout
        </Button>
      </Stack>
      <ConfirmDialog
        open={confirming}
        title="Finish workout?"
        message={
          pending === 1
            ? 'One exercise is not logged. It will be marked as skipped.'
            : `${pending} exercises are not logged. They will be marked as skipped.`
        }
        confirmLabel="Finish"
        onConfirm={() => void finish()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
