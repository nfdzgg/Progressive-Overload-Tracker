import { useState } from 'react';
import {
  setCycleDayToday,
  useCycle,
  useSessionEntries,
  useSessions,
  useToday,
  useWorkouts,
} from '../../data';
import { formatDate } from '../../domain';
import { Badge, ListGroup, ListItem, ListRow, Sheet, Stack, Text } from '../../ui';
import { cycleItemLabel } from './cycleEdit';

/**
 * "Day in cycle": which day of the cycle is today, for someone who starts
 * using the app partway through their cycle. Picking a day makes Today show it
 * now, and the cycle continues in order from there.
 */
export function CycleDayRow() {
  const today = useToday();
  const cycle = useCycle();
  const workouts = useWorkouts();
  const started = useSessions()?.find((s) => s.status === 'inProgress');
  const startedEntries = useSessionEntries(started?.id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cycle || !workouts) return null;
  const { items, pointer, restartOn } = cycle;
  const count = items.length;
  const label = (i: number) => cycleItemLabel(items[i], workouts);
  const waiting = restartOn !== null && today < restartOn;
  const doneToday = !waiting && cycle.pointerSince > today;

  let detail = 'Add items to the cycle first';
  if (count > 0 && waiting) {
    detail = `Restarts from ${label(0)} on ${formatDate(restartOn)}`;
  } else if (count > 0 && doneToday) {
    detail = `Done for today. Next: ${label(pointer)}, day ${pointer + 1} of ${count}`;
  } else if (count > 0) {
    detail = `Today: ${label(pointer)}, day ${pointer + 1} of ${count}`;
  }

  const logged = startedEntries?.some((e) => e.status === 'logged') ?? false;
  const drafts = startedEntries?.some((e) => e.status === 'draft') ?? false;

  async function choose(index: number) {
    try {
      await setCycleDayToday(index, today);
      setError(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function close() {
    setError(null);
    setOpen(false);
  }

  return (
    <ListItem>
      <ListRow
        title="Day in cycle"
        detail={detail}
        chevron={count > 0}
        onClick={count > 0 ? () => setOpen(true) : undefined}
      />
      <Sheet open={open} onClose={close} title="Day in cycle">
        <Stack gap="md">
          <Text as="p" variant="body-sm" tone="subtle">
            Which day of your cycle is today? Today shows it, and the cycle continues in order from
            there.
          </Text>
          {started && logged ? (
            <Text as="p" variant="body-sm">
              You have logged sets in today&rsquo;s {started.workoutName} workout. Finish it on
              Today first, then choose the day.
            </Text>
          ) : (
            <>
              {started && drafts && (
                <Text as="p" variant="body-sm" tone="subtle">
                  Numbers typed into {started.workoutName} and not logged yet are cleared if you
                  pick a different workout.
                </Text>
              )}
              <ListGroup label="Cycle days">
                {items.map((_, i) => {
                  const badge = i !== pointer || waiting ? null : doneToday ? 'Next' : 'Today';
                  return (
                    <ListItem key={i}>
                      <ListRow
                        leading={i + 1}
                        title={label(i)}
                        trailing={badge && <Badge>{badge}</Badge>}
                        ariaLabel={`Day ${i + 1}, ${label(i)}${badge ? `, ${badge.toLowerCase()}` : ''}`}
                        onClick={() => void choose(i)}
                      />
                    </ListItem>
                  );
                })}
              </ListGroup>
            </>
          )}
          <div role="alert">
            {error && (
              <Text as="p" variant="body-sm" tone="danger">
                {error}
              </Text>
            )}
          </div>
        </Stack>
      </Sheet>
    </ListItem>
  );
}
