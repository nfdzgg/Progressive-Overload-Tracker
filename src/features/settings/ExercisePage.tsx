import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import { exerciseHasHistory, removeExercise, updateExercise, useAllExercises } from '../../data';
import type { Exercise } from '../../domain';
import { Button, ConfirmDialog, EmptyState, Screen, Stack, Text } from '../../ui';
import { ExerciseFields } from './ExerciseFields';
import {
  exercisePatch,
  formFromExercise,
  validateExerciseForm,
  type ExerciseForm,
} from './exerciseForm';
import { useSettingsNav } from './nav';
import { VariantsEditor } from './VariantsEditor';

/** Edit a library exercise. Changes save as they are made (valid values only). */
export function ExercisePage() {
  const { exerciseId } = useParams();
  const nav = useSettingsNav();
  const all = useAllExercises();
  const back = () => nav.back('/settings/exercises');

  if (!all) {
    return (
      <Screen title="Exercise" onBack={back}>
        {null}
      </Screen>
    );
  }
  const exercise = all.find((e) => e.id === exerciseId);
  if (!exercise || exercise.archived) {
    return (
      <Screen title="Exercise" onBack={back}>
        <EmptyState title="This exercise is no longer in your library." />
      </Screen>
    );
  }
  const takenNames = all.filter((e) => !e.archived && e.id !== exercise.id).map((e) => e.name);
  return (
    <ExerciseEditor key={exercise.id} exercise={exercise} takenNames={takenNames} onDone={back} />
  );
}

function ExerciseEditor({
  exercise,
  takenNames,
  onDone,
}: {
  exercise: Exercise;
  takenNames: string[];
  onDone: () => void;
}) {
  const [form, setForm] = useState(() => formFromExercise(exercise));
  const errors = validateExerciseForm(form, takenNames);

  function change(next: ExerciseForm) {
    setForm(next);
    void updateExercise(exercise.id, exercisePatch(next, validateExerciseForm(next, takenNames)));
  }

  return (
    <Screen title={exercise.name} onBack={onDone}>
      <Stack gap="xl">
        <ExerciseFields form={form} errors={errors} onChange={change} creating={false} />
        <VariantsEditor exercise={exercise} />
        <RemoveExercise exercise={exercise} onRemoved={onDone} />
      </Stack>
    </Screen>
  );
}

/**
 * SPEC 4.3: an exercise with history is archived (it leaves workouts and
 * pickers; history, charts, and PRs remain); one without is deleted.
 */
function RemoveExercise({ exercise, onRemoved }: { exercise: Exercise; onRemoved: () => void }) {
  const hasHistory = useLiveQuery(() => exerciseHasHistory(exercise.id), [exercise.id]);
  const [confirming, setConfirming] = useState(false);
  const verb = hasHistory ? 'Archive' : 'Delete';

  return (
    <Stack gap="xs" align="start">
      <Button
        variant="destructive"
        disabled={hasHistory === undefined}
        onClick={() => setConfirming(true)}
      >
        {verb} exercise
      </Button>
      <Text as="p" variant="caption" tone="tertiary">
        {hasHistory
          ? 'It has logged history, so it is archived rather than deleted.'
          : 'It has no logged history, so it can be deleted.'}
      </Text>
      <ConfirmDialog
        open={confirming}
        title={`${verb} ${exercise.name}?`}
        message={
          hasHistory
            ? `${exercise.name} has logged history, so it is archived: it leaves your workouts, the library, and pickers, and its history, charts, and PRs stay.`
            : `${exercise.name} has no logged history, so it is deleted for good and removed from your workouts.`
        }
        confirmLabel={verb}
        tone="destructive"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemoved();
          void removeExercise(exercise.id);
        }}
      />
    </Stack>
  );
}
