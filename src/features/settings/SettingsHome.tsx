import { useId } from 'react';
import { useCycle, useExercises, useWorkouts } from '../../data';
import { Card, ListGroup, ListItem, ListRow, Screen, SectionLabel, Stack } from '../../ui';
import { DataSection } from '../backup';
import { AboutSection } from './AboutSection';
import { cycleSummary } from './cycleEdit';
import { useSettingsNav } from './nav';
import { PreferencesSection } from './PreferencesSection';
import { RestartCycle } from './RestartCycle';

/** Settings (SPEC 6.6): Routine, Preferences, Data, About, top to bottom. */
export function SettingsHome() {
  return (
    <Screen title="Settings">
      <Stack gap="xl">
        <RoutineSection />
        <PreferencesSection />
        <DataSection />
        <AboutSection />
      </Stack>
    </Screen>
  );
}

function RoutineSection() {
  const labelId = useId();
  const nav = useSettingsNav();
  const cycle = useCycle();
  const workouts = useWorkouts();
  const exercises = useExercises();
  const summary = cycle && workouts ? cycleSummary(cycle.items, workouts) : '';

  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>Routine</SectionLabel>
      <Stack gap="sm">
        <Card variant="group">
          <ListGroup label="Routine">
            <ListItem>
              <ListRow
                title="Cycle"
                detail={cycle ? summary || 'No items yet' : undefined}
                chevron
                onClick={() => nav.open('/settings/cycle')}
              />
            </ListItem>
            <ListItem>
              <ListRow
                title="Workouts"
                trailing={workouts?.length}
                chevron
                onClick={() => nav.open('/settings/workouts')}
              />
            </ListItem>
            <ListItem>
              <ListRow
                title="Exercises"
                trailing={exercises?.length}
                chevron
                onClick={() => nav.open('/settings/exercises')}
              />
            </ListItem>
          </ListGroup>
        </Card>
        <RestartCycle />
      </Stack>
    </section>
  );
}
