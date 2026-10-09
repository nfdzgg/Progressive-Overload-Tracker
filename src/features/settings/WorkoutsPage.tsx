import { useState } from 'react';
import { createWorkout, useWorkouts } from '../../data';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListItem,
  ListRow,
  Screen,
} from '../../ui';
import { validateName } from './exerciseForm';
import { NameSheet } from './NameSheet';
import { useSettingsNav } from './nav';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Workouts: the list, and creating a new one. */
export function WorkoutsPage() {
  const nav = useSettingsNav();
  const workouts = useWorkouts();
  const [creating, setCreating] = useState(false);

  const sorted = [...(workouts ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen
      title="Workouts"
      onBack={() => nav.back('/settings')}
      action={
        <IconButton icon="plus" size="tab" label="New workout" onClick={() => setCreating(true)} />
      }
    >
      {workouts &&
        (sorted.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            message="Create a workout, add exercises to it, then put it in the cycle."
            action={<Button onClick={() => setCreating(true)}>New workout</Button>}
          />
        ) : (
          <Card variant="group">
            <ListGroup label="Workouts">
              {sorted.map((w) => (
                <ListItem key={w.id}>
                  <ListRow
                    title={w.name}
                    detail={plural(w.exerciseIds.length, 'exercise')}
                    chevron
                    onClick={() => nav.open(`/settings/workouts/${w.id}`)}
                  />
                </ListItem>
              ))}
            </ListGroup>
          </Card>
        ))}
      <NameSheet
        open={creating}
        title="New workout"
        label="Name"
        placeholder="e.g. Upper"
        confirmLabel="Create workout"
        validate={validateName}
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          const workout = await createWorkout(name);
          setCreating(false);
          nav.open(`/settings/workouts/${workout.id}`);
        }}
      />
    </Screen>
  );
}
