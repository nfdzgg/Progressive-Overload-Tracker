import { useExercises } from '../../data';
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
import { exerciseSummary } from './exerciseForm';
import { useSettingsNav } from './nav';

/** The exercise library: active exercises sorted by name (archived ones are hidden). */
export function ExercisesPage() {
  const nav = useSettingsNav();
  const exercises = useExercises();
  const create = () => nav.open('/settings/exercises/new');

  return (
    <Screen
      title="Exercises"
      onBack={() => nav.back('/settings')}
      action={<IconButton icon="plus" size="tab" label="New exercise" onClick={create} />}
    >
      {exercises &&
        (exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            message="Create exercises here, then add them to your workouts."
            action={<Button onClick={create}>New exercise</Button>}
          />
        ) : (
          <Card variant="group">
            <ListGroup label="Exercises">
              {exercises.map((e) => (
                <ListItem key={e.id}>
                  <ListRow
                    title={e.name}
                    detail={exerciseSummary(e)}
                    chevron
                    onClick={() => nav.open(`/settings/exercises/${e.id}`)}
                  />
                </ListItem>
              ))}
            </ListGroup>
          </Card>
        ))}
    </Screen>
  );
}
