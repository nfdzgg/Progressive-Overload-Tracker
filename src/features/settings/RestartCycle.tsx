import { useState } from 'react';
import {
  restartCycleOnMonday,
  restartCycleToday,
  useCycle,
  useToday,
  useWorkouts,
} from '../../data';
import { currentItem, formatDate, nextMonday } from '../../domain';
import { Button, Card, ConfirmDialog, Inline, Stack, Text } from '../../ui';
import { cycleItemLabel } from './cycleEdit';
import styles from './Settings.module.css';

type Pending = 'today' | 'monday' | null;

/** Restart cycle (SPEC 5.1): today, or on the coming Monday. Both confirm first. */
export function RestartCycle() {
  const today = useToday();
  const cycle = useCycle();
  const workouts = useWorkouts();
  const [pending, setPending] = useState<Pending>(null);

  if (!cycle || !workouts) return null;
  const empty = cycle.items.length === 0;
  const first = empty ? '' : cycleItemLabel(cycle.items[0], workouts);
  const next = currentItem(cycle);
  const monday = formatDate(nextMonday(today));

  let status = 'Add items to the cycle first.';
  if (cycle.restartOn) {
    status = `Restarts from ${first} on ${formatDate(cycle.restartOn)}.`;
  } else if (next && cycle.pointer === 0) {
    status = `Next up: ${first}, the first item.`;
  } else if (next) {
    status = `Next up: ${cycleItemLabel(next, workouts)}. Restarting goes back to ${first}.`;
  }

  async function confirm() {
    const action = pending;
    setPending(null);
    if (action === 'today') await restartCycleToday(today);
    if (action === 'monday') await restartCycleOnMonday(today);
  }

  return (
    <>
      <Card variant="group" as="section" aria-label="Restart cycle">
        <div className={styles.inset}>
          <Stack gap="sm">
            <Stack gap="xxs">
              <Text as="h3" variant="body">
                Restart cycle
              </Text>
              <Text as="p" variant="body-sm" tone="subtle">
                {status}
              </Text>
            </Stack>
            <Inline gap="xs" wrap>
              <Button variant="destructive" disabled={empty} onClick={() => setPending('today')}>
                Restart today
              </Button>
              <Button variant="destructive" disabled={empty} onClick={() => setPending('monday')}>
                Restart on Monday
              </Button>
            </Inline>
          </Stack>
        </div>
      </Card>
      <ConfirmDialog
        open={pending === 'today'}
        title="Restart cycle today?"
        message={`Today becomes ${first}, the first item in your cycle, and the cycle continues in order from there. Your current place in the cycle is not kept.`}
        confirmLabel="Restart today"
        tone="destructive"
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'monday'}
        title="Restart on Monday?"
        message={`Until ${monday}, Today shows a rest day with a Start now button. On ${monday} the cycle starts again from ${first}, its first item.`}
        confirmLabel="Restart on Monday"
        tone="destructive"
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
