import { startNextWorkoutToday } from '../../data';
import { formatDate, formatEntrySummary, prsForLoggedEntry, type Session } from '../../domain';
import { Badge, Button, Card, ListGroup, ListItem, ListRow, Screen, Stack, Text } from '../../ui';
import { finishedRows } from './todayModel';
import type { TodayData } from './useTodayData';

export interface FinishedViewProps {
  data: TodayData;
  /** The finished session (null if it cannot be found). */
  session: Session | null;
}

/** Today's workout is done: a compact summary and "Start next workout". */
export function FinishedView({ data, session }: FinishedViewProps) {
  const workout = session ? data.workoutsById.get(session.workoutId) : undefined;
  const rows = session
    ? finishedRows(
        workout,
        data.entries.filter((e) => e.sessionId === session.id),
      )
    : [];
  const when = session && session.date !== data.today ? ` · ${formatDate(session.date)}` : '';

  return (
    <Screen title={session?.workoutName ?? 'Today'}>
      <Stack gap="lg">
        <Stack gap="sm">
          <Text as="p" variant="body-sm" tone="subtle">
            Workout finished{when}
          </Text>
          {rows.length > 0 && (
            <Card variant="group">
              <ListGroup label="Finished workout">
                {rows.map((entry) => {
                  const exercise = data.exercisesById.get(entry.exerciseId);
                  const skipped = entry.status !== 'logged';
                  const pr =
                    !skipped &&
                    exercise !== undefined &&
                    prsForLoggedEntry(entry, data.entries, data.sessionsById, exercise).length > 0;
                  return (
                    <ListItem key={entry.id}>
                      <ListRow
                        title={exercise?.name ?? 'Exercise'}
                        detail={skipped ? 'Skipped' : formatEntrySummary(entry, data.unit)}
                        trailing={pr ? <Badge tone="success">PR</Badge> : undefined}
                      />
                    </ListItem>
                  );
                })}
              </ListGroup>
            </Card>
          )}
        </Stack>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void startNextWorkoutToday(data.today)}
        >
          Start next workout
        </Button>
      </Stack>
    </Screen>
  );
}
