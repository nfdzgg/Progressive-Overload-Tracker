import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createExercise, updateExercise, useExercises } from '../../data';
import { Button, Screen, Stack, TextInput } from '../../ui';
import { ExerciseFields } from './ExerciseFields';
import {
  exercisePatch,
  hasErrors,
  newExerciseForm,
  newExerciseInput,
  validateExerciseForm,
} from './exerciseForm';
import { useSettingsNav } from './nav';

/** Create a library exercise; afterwards its edit page opens for adding variants. */
export function NewExercisePage() {
  const nav = useSettingsNav();
  const exercises = useExercises();
  const [form, setForm] = useState(newExerciseForm);
  const [variantName, setVariantName] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validateExerciseForm(form, exercises?.map((e) => e.name) ?? []);
  // An empty name only complains after a try.
  const shown = tried || form.name.trim() !== '' ? errors : { ...errors, name: undefined };

  async function create() {
    flushSync(() => setTried(true));
    if (hasErrors(errors)) {
      // The first problem may be scrolled out of view: take the user there.
      // Centered, so the sticky top bar never covers it.
      const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      field?.focus({ preventScroll: true });
      field?.scrollIntoView?.({ block: 'center' });
      return;
    }
    if (saving) return;
    setSaving(true);
    const created = await createExercise(newExerciseInput(form, variantName));
    // createExercise applies the type defaults; keep any edits to rep range and rest.
    const { repMin, repMax, restSeconds } = exercisePatch(form, errors);
    await updateExercise(created.id, { repMin, repMax, restSeconds });
    nav.replace(`/settings/exercises/${created.id}`);
  }

  return (
    <Screen title="New exercise" onBack={() => nav.back('/settings/exercises')}>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Stack gap="lg">
          <ExerciseFields form={form} errors={shown} onChange={setForm} creating />
          <TextInput
            label="Main variant"
            placeholder="Standard"
            hint="How you usually do it, e.g. Machine. Add more variants after creating."
            autoComplete="off"
            value={variantName}
            onValueChange={setVariantName}
          />
          <Button type="submit" variant="primary" fullWidth disabled={saving}>
            Create exercise
          </Button>
        </Stack>
      </form>
    </Screen>
  );
}
