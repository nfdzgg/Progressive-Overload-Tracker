import { useState } from 'react';
import { setVariantNote } from '../../data';
import type { Exercise, Variant } from '../../domain';
import { Button, Sheet, TextArea } from '../../ui';

export interface NotesSheetProps {
  exercise: Exercise;
  /** The variant selected on the card; notes are per variant. */
  variant: Variant;
  onClose: () => void;
}

/** The note for one variant (seat height, pin setting), edited in a sheet. */
export function NotesSheet({ exercise, variant, onClose }: NotesSheetProps) {
  const [note, setNote] = useState(variant.note);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setVariantNote(exercise.id, variant.id, note.trim());
      onClose();
    } catch (error) {
      console.error(error);
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${exercise.name} · ${variant.name}`}
      footer={
        <Button variant="primary" fullWidth disabled={saving} onClick={() => void save()}>
          Save note
        </Button>
      }
    >
      <TextArea
        label="Note"
        hideLabel
        placeholder="Seat height, pin setting"
        value={note}
        onValueChange={setNote}
      />
    </Sheet>
  );
}
