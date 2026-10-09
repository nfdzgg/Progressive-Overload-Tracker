import { useId } from 'react';
import { updateSettings, useSettings } from '../../data';
import type { Unit } from '../../domain';
import {
  Card,
  ChipGroup,
  ListGroup,
  ListItem,
  ListRow,
  SectionLabel,
  type ChipOption,
} from '../../ui';

const UNIT_OPTIONS: ChipOption<Unit>[] = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

type OnOff = 'on' | 'off';
const ON_OFF: ChipOption<OnOff>[] = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
const toOnOff = (value: boolean): OnOff => (value ? 'on' : 'off');

/** Unit, rest timer on/off, timer sound on/off (chip groups, PROGRESS decision 3). */
export function PreferencesSection() {
  const labelId = useId();
  const settings = useSettings();

  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>Preferences</SectionLabel>
      {settings && (
        <Card variant="group">
          <ListGroup label="Preferences">
            <ListItem>
              <ListRow
                title="Unit"
                trailing={
                  <ChipGroup
                    label="Unit"
                    options={UNIT_OPTIONS}
                    value={settings.unit}
                    onChange={(unit) => void updateSettings({ unit })}
                  />
                }
              />
            </ListItem>
            <ListItem>
              <ListRow
                title="Rest timer"
                trailing={
                  <ChipGroup
                    label="Rest timer"
                    options={ON_OFF}
                    value={toOnOff(settings.restTimerEnabled)}
                    onChange={(v) => void updateSettings({ restTimerEnabled: v === 'on' })}
                  />
                }
              />
            </ListItem>
            <ListItem>
              <ListRow
                title="Timer sound"
                trailing={
                  <ChipGroup
                    label="Timer sound"
                    options={ON_OFF}
                    value={toOnOff(settings.restTimerSound)}
                    onChange={(v) => void updateSettings({ restTimerSound: v === 'on' })}
                  />
                }
              />
            </ListItem>
          </ListGroup>
        </Card>
      )}
    </section>
  );
}
