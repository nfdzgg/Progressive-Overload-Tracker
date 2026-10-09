import { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { CalendarDay } from './CalendarDay';
import { Card, CardHeader, DashboardCard } from './Card';
import { ChipGroup } from './Chip';
import { ConfirmDialog } from './Dialog';
import { EmptyState, SectionLabel } from './EmptyState';
import { Icon, ICON_NAMES } from './Icon';
import { IconButton } from './IconButton';
import { Inline, Stack } from './Layout';
import { ListGroup, ListItem, ListRow } from './ListRow';
import { NumberInput } from './NumberInput';
import { RestTimerBar } from './RestTimerBar';
import { Screen } from './Screen';
import { Sheet } from './Sheet';
import { TabBar } from './TabBar';
import { Text, type TypeVariant } from './Text';
import { Select, TextArea, TextInput } from './TextField';
import { BarChart, ComparisonBars } from './charts/BarChart';
import { LineChart } from './charts/LineChart';

const TYPE_VARIANTS: TypeVariant[] = [
  'display-md',
  'headline',
  'card-title',
  'subhead',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'button',
  'eyebrow',
  'mono',
];

/** Hidden page (`#/kitchen-sink`) showing every shared component for visual checks. */
export function KitchenSink() {
  const [variant, setVariant] = useState('machine');
  const [range, setRange] = useState('3m');
  const [weight, setWeight] = useState('100');
  const [set1, setSet1] = useState('');
  const [set2, setSet2] = useState('');
  const [name, setName] = useState('Chest press');
  const [note, setNote] = useState('Seat 4, pin 7');
  const [type, setType] = useState('upperCompound');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Screen title="Kitchen sink" action={<IconButton icon="plus" label="Add" size="tab" />}>
      <Stack gap="xl">
        <Stack gap="sm">
          <SectionLabel>Typography</SectionLabel>
          {TYPE_VARIANTS.map((v) => (
            <Text key={v} variant={v} as="p">
              {v} 1234567890
            </Text>
          ))}
          <Inline gap="sm" wrap>
            <Text tone="muted">muted</Text>
            <Text tone="subtle">subtle</Text>
            <Text tone="tertiary">tertiary</Text>
            <Text tone="success">success</Text>
            <Text tone="danger">danger</Text>
          </Inline>
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Buttons</SectionLabel>
          <Inline gap="xs" wrap>
            <Button variant="primary">Log</Button>
            <Button variant="secondary">Export</Button>
            <Button variant="tertiary">Cancel</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Inline>
          <Inline gap="xs" wrap>
            {ICON_NAMES.map((icon) => (
              <IconButton key={icon} icon={icon} label={icon} marker={icon === 'notes'} />
            ))}
          </Inline>
          <Inline gap="xs">
            <Icon name="today" size="tab" />
            <Badge>Deload</Badge>
            <Badge tone="success">PR</Badge>
            <Badge tone="success">Add weight</Badge>
          </Inline>
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Exercise cards</SectionLabel>
          <Card variant="exercise">
            <Stack gap="sm">
              <CardHeader
                title="Chest press"
                actions={
                  <>
                    <IconButton icon="notes" label="Notes" marker />
                    <IconButton icon="more" label="More" />
                  </>
                }
              />
              <ChipGroup
                label="Variant"
                value={variant}
                onChange={setVariant}
                options={[
                  { value: 'machine', label: 'Machine' },
                  { value: 'bench', label: 'Bench' },
                  { value: 'dumbbell', label: 'Dumbbell on bench' },
                ]}
              />
              <Text variant="body-sm" tone="muted" as="p">
                Last: 100 lb × 10, 9 · Beat: one more rep
              </Text>
              <Inline gap="xs">
                <NumberInput
                  label="Weight"
                  mode="decimal"
                  unit="lb"
                  value={weight}
                  onValueChange={setWeight}
                />
                <NumberInput
                  label="Set 1"
                  mode="numeric"
                  placeholder="10"
                  value={set1}
                  onValueChange={setSet1}
                />
                <NumberInput
                  label="Set 2"
                  mode="numeric"
                  placeholder="9"
                  value={set2}
                  onValueChange={setSet2}
                />
                <Button variant="primary">Log</Button>
              </Inline>
            </Stack>
          </Card>
          <Card variant="exercise-done">
            <Stack gap="xs">
              <CardHeader title="Incline press" subdued />
              <Inline gap="xs">
                <Text variant="body-sm" tone="subtle">
                  80 lb × 12, 12
                </Text>
                <Badge tone="success">PR</Badge>
              </Inline>
            </Stack>
          </Card>
          <Card variant="exercise">
            <Text tone="tertiary" variant="body-sm">
              Nothing logged this way yet
            </Text>
          </Card>
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Inputs</SectionLabel>
          <TextInput label="Exercise name" value={name} onValueChange={setName} />
          <TextInput label="Invalid" value="" error="Name is required" onValueChange={() => {}} />
          <TextArea label="Note" value={note} onValueChange={setNote} />
          <Select
            label="Type"
            value={type}
            onValueChange={setType}
            options={[
              { value: 'legCompound', label: 'Leg compound' },
              { value: 'upperCompound', label: 'Upper compound' },
            ]}
          />
          <ChipGroup
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: '1m', label: '1M' },
              { value: '3m', label: '3M' },
              { value: 'all', label: 'All' },
            ]}
          />
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Lists</SectionLabel>
          <Card variant="group">
            <ListGroup label="Settings">
              <ListItem>
                <ListRow title="Cycle" detail="Push, Pull, Legs, Rest" chevron onClick={() => {}} />
              </ListItem>
              <ListItem>
                <ListRow title="Unit" trailing="lb" />
              </ListItem>
              <ListItem>
                <ListRow title="Restart cycle" destructive onClick={() => setDialogOpen(true)} />
              </ListItem>
            </ListGroup>
          </Card>
          <EmptyState
            title="No PRs yet"
            message="Personal records show up here after your second session of an exercise."
          />
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Dashboard</SectionLabel>
          <DashboardCard label="This week" value="3 sessions">
            <Text variant="body-sm" tone="subtle">
              2 PRs · 36 hard sets
            </Text>
          </DashboardCard>
          <DashboardCard label="e1RM">
            <LineChart
              ariaLabel="Estimated 1RM"
              formatY={(v) => `${Math.round(v)}`}
              series={[
                {
                  id: 'e1rm',
                  name: 'e1RM',
                  tone: 'primary',
                  points: [
                    { x: 1, y: 120 },
                    { x: 2, y: 124, highlight: true },
                    { x: 3, y: 118, muted: true },
                    { x: 4, y: 128, highlight: true },
                  ],
                },
                {
                  id: 'top',
                  name: 'Top weight',
                  tone: 'secondary',
                  points: [
                    { x: 1, y: 100 },
                    { x: 2, y: 100 },
                    { x: 3, y: 95 },
                    { x: 4, y: 105 },
                  ],
                },
              ]}
            />
          </DashboardCard>
          <DashboardCard label="Volume">
            <BarChart
              ariaLabel="Weekly volume"
              bars={[
                { label: 'W1', value: 8200 },
                { label: 'W2', value: 9100 },
                { label: 'W3', value: 7600 },
                { label: 'W4', value: 9800, current: true },
              ]}
            />
          </DashboardCard>
          <DashboardCard label="Sets per muscle group">
            <ComparisonBars
              ariaLabel="Sets per muscle group"
              currentLabel="This week"
              previousLabel="Last week"
              rows={[
                { label: 'Chest', current: 8, previous: 6 },
                { label: 'Back', current: 6, previous: 8 },
              ]}
            />
          </DashboardCard>
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Calendar</SectionLabel>
          <Inline gap="xxs">
            <CalendarDay day={1} label="Push" completed ariaLabel="1, Push, finished" />
            <CalendarDay day={2} label="Pull" isToday ariaLabel="2, today, Pull" />
            <CalendarDay day={3} label="Legs" muted ariaLabel="3, Legs, planned" />
            <CalendarDay day={4} label="Rest" muted ariaLabel="4, Rest" />
          </Inline>
        </Stack>

        <Stack gap="sm">
          <SectionLabel>Overlays</SectionLabel>
          <RestTimerBar
            label="Leg press"
            remainingMs={95_000}
            totalMs={180_000}
            onDismiss={() => {}}
          />
          <RestTimerBar label="Row" remainingMs={0} totalMs={150_000} onDismiss={() => {}} />
          <Inline gap="xs">
            <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
            <Button variant="destructive" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
          </Inline>
          <TabBar
            items={[
              { label: 'Today', icon: 'today', href: '#/kitchen-sink', active: true },
              { label: 'Calendar', icon: 'calendar', href: '#/kitchen-sink', active: false },
              { label: 'Progress', icon: 'progress', href: '#/kitchen-sink', active: false },
              { label: 'Settings', icon: 'settings', href: '#/kitchen-sink', active: false },
            ]}
          />
        </Stack>
      </Stack>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Chest press · Machine"
        footer={
          <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
            Save note
          </Button>
        }
      >
        <TextArea label="Note" hideLabel value={note} onValueChange={setNote} />
      </Sheet>
      <ConfirmDialog
        open={dialogOpen}
        title="Restart cycle?"
        message="Today becomes the first workout in your cycle."
        confirmLabel="Restart"
        tone="destructive"
        onConfirm={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
      />
    </Screen>
  );
}
