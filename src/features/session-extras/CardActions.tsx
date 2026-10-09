import { useState } from 'react';
import { useExercise } from '../../data';
import { IconButton, Inline } from '../../ui';
import type { TodayCardContext } from '../today';
import { MoreSheet } from './MoreSheet';
import { NotesSheet } from './NotesSheet';

/**
 * Rendered by Today at the right of every card header: the notes icon (with a
 * subtle marker when the selected variant has a note) and the "more" icon.
 * Each opens its sheet; nothing is shown inline on the card.
 */
export function CardHeaderActions(context: TodayCardContext) {
  const [open, setOpen] = useState<'notes' | 'more' | null>(null);
  const { exercise, variant, slotExerciseId } = context;
  const hasNote = variant.note.trim() !== '';
  // Loaded ahead of time so the menu's "Swap back to …" row is ready when it opens.
  const slotExercise = useExercise(exercise.id !== slotExerciseId ? slotExerciseId : undefined);
  const close = () => setOpen(null);

  return (
    <Inline as="span" gap="xs">
      <IconButton
        icon="notes"
        label={`Notes for ${exercise.name}${hasNote ? ', has a note' : ''}`}
        marker={hasNote}
        onClick={() => setOpen('notes')}
      />
      <IconButton icon="more" label={`More for ${exercise.name}`} onClick={() => setOpen('more')} />
      {open === 'notes' && <NotesSheet exercise={exercise} variant={variant} onClose={close} />}
      {open === 'more' && (
        <MoreSheet context={context} slotExerciseName={slotExercise?.name} onClose={close} />
      )}
    </Inline>
  );
}
