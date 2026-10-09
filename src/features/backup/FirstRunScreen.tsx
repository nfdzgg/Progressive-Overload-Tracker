// SPEC 6.1: choose the Push / Pull / Legs template or a blank start, and lb
// or kg. Saving sets `onboarded`, and the app switches to the tabs by itself.
import { useId, useRef, useState } from 'react';
import { completeFirstRun } from '../../data';
import { todayISO, type Unit } from '../../domain';
import {
  Button,
  ChipGroup,
  Icon,
  SectionLabel,
  Screen,
  Stack,
  Text,
  VisuallyHidden,
  type ChipOption,
} from '../../ui';
import { requestPersistentStorage } from './persist';
import styles from './FirstRunScreen.module.css';

type StartChoice = 'template' | 'blank';

const START_OPTIONS: ReadonlyArray<{ value: StartChoice; title: string; detail: string }> = [
  {
    value: 'template',
    title: 'Push / Pull / Legs template',
    // Non-breaking space keeps "16 exercises" on one line.
    detail: 'Push, Pull, Legs, Push, Pull, Legs, Rest. 16 exercises, all editable in Settings.',
  },
  {
    value: 'blank',
    title: 'Start blank',
    detail: 'An empty library. Add your own exercises, workouts, and cycle in Settings.',
  },
];

const UNIT_OPTIONS: ReadonlyArray<ChipOption<Unit>> = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

interface StartOptionProps {
  name: string;
  value: StartChoice;
  title: string;
  detail: string;
  selected: boolean;
  onSelect: (value: StartChoice) => void;
}

/** A selectable card backed by a native radio (keyboard and screen readers for free). */
function StartOption({ name, value, title, detail, selected, onSelect }: StartOptionProps) {
  const id = useId();
  return (
    <label className={selected ? `${styles.option} ${styles.selected}` : styles.option}>
      <VisuallyHidden>
        <input
          type="radio"
          name={name}
          value={value}
          checked={selected}
          onChange={() => onSelect(value)}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-detail`}
        />
      </VisuallyHidden>
      <span className={styles.text}>
        <Text id={`${id}-title`} variant="body" weight="medium">
          {title}
        </Text>
        <Text id={`${id}-detail`} variant="body-sm" tone="subtle">
          {detail}
        </Text>
      </span>
      <span className={styles.check}>{selected && <Icon name="check" />}</span>
    </label>
  );
}

export function FirstRunScreen() {
  const [choice, setChoice] = useState<StartChoice>('template');
  const [unit, setUnit] = useState<Unit>('lb');
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const startLabelId = useId();
  const groupName = useId();

  async function getStarted() {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    try {
      await completeFirstRun(choice, unit, todayISO());
    } catch {
      saving.current = false;
      setError('Could not save your choice. Try again.');
      return;
    }
    // The app now shows the tabs (onboarded is set); persistence is best effort.
    void requestPersistentStorage();
  }

  return (
    <Screen title="Welcome">
      <Stack gap="xl">
        <section>
          <SectionLabel id={startLabelId}>Start with</SectionLabel>
          <div role="radiogroup" aria-labelledby={startLabelId} className={styles.options}>
            {START_OPTIONS.map((option) => (
              <StartOption
                key={option.value}
                name={groupName}
                {...option}
                selected={choice === option.value}
                onSelect={setChoice}
              />
            ))}
          </div>
        </section>
        <section>
          <SectionLabel>Unit</SectionLabel>
          <ChipGroup label="Unit" options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
        </section>
        <Stack gap="xs">
          <Button variant="primary" fullWidth onClick={getStarted}>
            Get started
          </Button>
          {error && (
            <div role="alert">
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            </div>
          )}
        </Stack>
      </Stack>
    </Screen>
  );
}
