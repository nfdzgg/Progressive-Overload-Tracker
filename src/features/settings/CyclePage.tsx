import type { ReactNode } from 'react';
import { useState } from 'react';
import { saveCycleItems, useCycle, useToday, useWorkouts } from '../../data';
import { formatDate, type CycleItem } from '../../domain';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListItem,
  ListRow,
  Screen,
  Sheet,
  Stack,
  Text,
} from '../../ui';
import {
  addCycleItem,
  cycleItemLabel,
  moveCycleItem,
  removeCycleItem,
  type CycleEdit,
} from './cycleEdit';
import { EditList, EditRow } from './EditRow';
import { useSettingsNav } from './nav';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Cycle editing: reorder, add, and remove workout and rest items. */
export function CyclePage() {
  const nav = useSettingsNav();
  const today = useToday();
  const cycle = useCycle();
  const workouts = useWorkouts();
  const [adding, setAdding] = useState(false);

  const screen = (children: ReactNode) => (
    <Screen title="Cycle" onBack={() => nav.back('/settings')}>
      {children}
    </Screen>
  );
  if (!cycle || !workouts) return screen(null);

  const { items, pointer } = cycle;
  const save = (edit: CycleEdit) => void saveCycleItems(edit.items, today, edit.pointer);
  const add = (item: CycleItem) => {
    save(addCycleItem(items, pointer, item));
    setAdding(false);
  };

  return screen(
    <Stack gap="md">
      <Text as="p" variant="body-sm" tone="subtle">
        The cycle repeats in this order. Today shows the next item; a missed day never skips a
        workout.
        {cycle.restartOn && ` Restarts from the first item on ${formatDate(cycle.restartOn)}.`}
      </Text>
      {items.length === 0 ? (
        <EmptyState
          title="No items in the cycle yet"
          message="Add your workouts and rest days in the order you train."
        />
      ) : (
        <Card variant="group">
          <EditList label="Cycle items">
            {items.map((item, i) => {
              const label = cycleItemLabel(item, workouts);
              return (
                <EditRow
                  key={i}
                  name={label}
                  rowLabel={`${i + 1}. ${label}`}
                  leading={i + 1}
                  badge={i === pointer ? <Badge>Next</Badge> : undefined}
                  index={i}
                  count={items.length}
                  onMove={(from, to) => save(moveCycleItem(items, pointer, from, to))}
                  actions={
                    <IconButton
                      icon="close"
                      label={`Remove ${label} from the cycle`}
                      onClick={() => save(removeCycleItem(items, pointer, i))}
                    />
                  }
                />
              );
            })}
          </EditList>
        </Card>
      )}
      <Button fullWidth onClick={() => setAdding(true)}>
        Add to cycle
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to cycle">
        <ListGroup label="Add to cycle">
          {[...workouts].sort(byName).map((w) => (
            <ListItem key={w.id}>
              <ListRow title={w.name} onClick={() => add({ kind: 'workout', workoutId: w.id })} />
            </ListItem>
          ))}
          <ListItem>
            <ListRow title="Rest day" onClick={() => add({ kind: 'rest' })} />
          </ListItem>
        </ListGroup>
        {workouts.length === 0 && (
          <Text as="p" variant="body-sm" tone="subtle">
            No workouts yet. Create them in Settings, Workouts.
          </Text>
        )}
      </Sheet>
    </Stack>,
  );
}
