import { useState } from 'react';
import {
  getSettings,
  setSessionDeload,
  skipSlot,
  swapSlot,
  useExercises,
  useToday,
} from '../../data';
import { MUSCLE_GROUP_LABELS, type LogEntry, type Session } from '../../domain';
import { Button, ConfirmDialog, ListGroup, ListItem, ListRow, Sheet } from '../../ui';
import type { TodayCardContext } from '../today';

export interface MoreSheetProps {
  context: TodayCardContext;
  /** Name of the slot's own exercise, for "Swap back" (when the slot is swapped). */
  slotExerciseName: string | undefined;
  onClose: () => void;
}

type View = { kind: 'menu' } | { kind: 'swap' } | { kind: 'confirmSwap'; toExerciseId: string };

/** Anything typed into the slot's entry (a swap would discard it). */
function hasNumbers(entry: LogEntry | undefined): boolean {
  if (!entry) return false;
  return entry.weight !== null || entry.sets.some((s) => s.reps !== null || s.weight !== null);
}

/**
 * The card's "more" menu: skip for today, swap for today (and back), and
 * mark the session as a deload. Each action closes the sheet; the session is
 * created on demand.
 */
export function MoreSheet({ context, slotExerciseName, onClose }: MoreSheetProps) {
  const { exercise, slotExerciseId, entry, session } = context;
  const today = useToday();
  const library = useExercises();
  const [view, setView] = useState<View>({ kind: 'menu' });

  const swapped = exercise.id !== slotExerciseId;
  const done = entry?.status === 'logged' || entry?.status === 'skipped';

  function run(action: (current: Session) => Promise<unknown>) {
    onClose();
    context
      .ensureSession()
      .then(action)
      .catch((error: unknown) => console.error(error));
  }

  const skip = () => run((current) => skipSlot(current.id, slotExerciseId, today));
  const toggleDeload = () => run((current) => setSessionDeload(current.id, !current.deload));
  const swapTo = (toExerciseId: string) =>
    run(async (current) => {
      const { unit } = await getSettings();
      await swapSlot(current.id, slotExerciseId, toExerciseId, unit);
    });
  const chooseSwap = (toExerciseId: string) =>
    hasNumbers(entry) ? setView({ kind: 'confirmSwap', toExerciseId }) : swapTo(toExerciseId);

  if (view.kind === 'confirmSwap') {
    const target = view.toExerciseId;
    return (
      <ConfirmDialog
        open
        title={`Swap ${exercise.name}?`}
        message={`The numbers entered for ${exercise.name} are discarded.`}
        confirmLabel="Swap"
        onConfirm={() => swapTo(target)}
        onCancel={onClose}
      />
    );
  }

  if (view.kind === 'swap') {
    const options = (library ?? []).filter((e) => e.id !== exercise.id);
    return (
      <Sheet
        open
        onClose={onClose}
        title={`Instead of ${exercise.name}`}
        footer={
          <Button variant="tertiary" fullWidth onClick={() => setView({ kind: 'menu' })}>
            Back
          </Button>
        }
      >
        <ListGroup label="Exercises">
          {options.map((option) => (
            <ListItem key={option.id}>
              <ListRow
                title={option.name}
                detail={MUSCLE_GROUP_LABELS[option.muscleGroup]}
                onClick={() => chooseSwap(option.id)}
              />
            </ListItem>
          ))}
        </ListGroup>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <ListGroup label="Actions">
        {!done && (
          <ListItem>
            <ListRow title="Skip for today" onClick={skip} />
          </ListItem>
        )}
        <ListItem>
          <ListRow title="Swap for today" chevron onClick={() => setView({ kind: 'swap' })} />
        </ListItem>
        {swapped && (
          <ListItem>
            <ListRow
              title={`Swap back to ${slotExerciseName ?? 'the planned exercise'}`}
              onClick={() => chooseSwap(slotExerciseId)}
            />
          </ListItem>
        )}
        <ListItem>
          <ListRow
            title={session?.deload ? 'Unmark deload' : 'Mark session as deload'}
            detail="Applies to the whole session"
            onClick={toggleDeload}
          />
        </ListItem>
      </ListGroup>
    </Sheet>
  );
}
