import { useId, useState } from 'react';
import { useParams } from 'react-router';
import {
  deleteWorkout,
  renameWorkout,
  setWorkoutExercises,
  useAllExercises,
  useCycle,
  useToday,
  useWorkouts,
} from '../../data';
import type { Exercise, Workout } from '../../domain';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  ListGroup,
  ListItem,
  ListRow,
  Screen,
  SectionLabel,
  Sheet,
  Stack,
  TextInput,
} from '../../ui';
import { moveItem } from './cycleEdit';
import { EditList, EditRow } from './EditRow';
import { exerciseSummary, validateName } from './exerciseForm';
import { useSettingsNav } from './nav';

/** One workout: rename, add/remove/reorder exercises, delete. */
export function WorkoutPage() {
  const { workoutId } = useParams();
  const nav = useSettingsNav();
  const workouts = useWorkouts();
  const exercises = useAllExercises();
  const back = () => nav.back('/settings/workouts');

  if (!workouts || !exercises) {
    return (
      <Screen title="Workout" onBack={back}>
        {null}
      </Screen>
    );
  }
  const workout = workouts.find((w) => w.id === workoutId);
  if (!workout) {
    return (
      <Screen title="Workout" onBack={back}>
        <EmptyState title="This workout no longer exists." />
      </Screen>
    );
  }
  return <WorkoutEditor key={workout.id} workout={workout} exercises={exercises} onDone={back} />;
}

function WorkoutEditor({
  workout,
  exercises,
  onDone,
}: {
  workout: Workout;
  exercises: Exercise[];
  onDone: () => void;
}) {
  const nav = useSettingsNav();
  const today = useToday();
  const cycle = useCycle();
  const labelId = useId();
  const [name, setName] = useState(workout.name);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  // Archived or missing exercises are not part of the workout any more.
  const members = workout.exerciseIds
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => !!e && !e.archived);
  const memberIds = members.map((e) => e.id);
  const available = exercises
    .filter((e) => !e.archived && !memberIds.includes(e.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const setExercises = (ids: string[]) => void setWorkoutExercises(workout.id, ids);

  const nameError = validateName(name);
  const cycleUses =
    cycle?.items.filter((i) => i.kind === 'workout' && i.workoutId === workout.id).length ?? 0;
  const inCycle =
    cycleUses === 0
      ? 'It is not in the cycle.'
      : `It is removed from the cycle (${cycleUses} ${cycleUses === 1 ? 'item' : 'items'}).`;

  return (
    <Screen title={workout.name} onBack={onDone}>
      <Stack gap="xl">
        <TextInput
          label="Name"
          value={name}
          error={nameError}
          autoComplete="off"
          onValueChange={(value) => {
            setName(value);
            if (!validateName(value)) void renameWorkout(workout.id, value);
          }}
        />

        <section aria-labelledby={labelId}>
          <SectionLabel id={labelId}>Exercises</SectionLabel>
          <Stack gap="sm">
            {members.length === 0 ? (
              <EmptyState
                title="No exercises yet"
                message="Add exercises from your library. Today shows them in this order."
              />
            ) : (
              <Card variant="group">
                <EditList label={`Exercises in ${workout.name}`}>
                  {members.map((e, i) => (
                    <EditRow
                      key={e.id}
                      name={e.name}
                      detail={exerciseSummary(e, false)}
                      index={i}
                      count={members.length}
                      onMove={(from, to) => setExercises(moveItem(memberIds, from, to))}
                      actions={
                        <IconButton
                          icon="close"
                          label={`Remove ${e.name} from ${workout.name}`}
                          onClick={() => setExercises(memberIds.filter((id) => id !== e.id))}
                        />
                      }
                    />
                  ))}
                </EditList>
              </Card>
            )}
            <Button fullWidth onClick={() => setPicking(true)}>
              Add exercise
            </Button>
          </Stack>
        </section>

        <Stack gap="xs" align="start">
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete workout
          </Button>
        </Stack>
      </Stack>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={`Add to ${workout.name}`}
        footer={
          <Button fullWidth onClick={() => setPicking(false)}>
            Done
          </Button>
        }
      >
        {available.length === 0 ? (
          <EmptyState
            title="Every library exercise is already in this workout."
            action={
              <Button
                onClick={() => {
                  setPicking(false);
                  nav.open('/settings/exercises/new');
                }}
              >
                New exercise
              </Button>
            }
          />
        ) : (
          <ListGroup label="Library">
            {available.map((e) => (
              <ListItem key={e.id}>
                <ListRow
                  title={e.name}
                  detail={exerciseSummary(e)}
                  ariaLabel={`Add ${e.name}`}
                  onClick={() => setExercises([...memberIds, e.id])}
                />
              </ListItem>
            ))}
          </ListGroup>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${workout.name}?`}
        message={`${inCycle} Past sessions keep their history. Exercises stay in your library.`}
        confirmLabel="Delete workout"
        tone="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDone();
          void deleteWorkout(workout.id, today);
        }}
      />
    </Screen>
  );
}
