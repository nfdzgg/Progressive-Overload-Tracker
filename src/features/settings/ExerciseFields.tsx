import {
  EXERCISE_TYPE_LABELS,
  EXERCISE_TYPES,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  SETS_MAX,
  SETS_MIN,
  type ExerciseType,
  type MuscleGroup,
} from '../../domain';
import {
  ChipGroup,
  Grow,
  Inline,
  sanitizeNumberText,
  Select,
  Stack,
  Text,
  TextInput,
  type ChipOption,
  type SelectOption,
} from '../../ui';
import { restOptions, withType, type ExerciseForm, type ExerciseFormErrors } from './exerciseForm';

const TYPE_OPTIONS: SelectOption<ExerciseType>[] = EXERCISE_TYPES.map((t) => ({
  value: t,
  label: EXERCISE_TYPE_LABELS[t],
}));

const MUSCLE_OPTIONS: SelectOption<MuscleGroup>[] = MUSCLE_GROUPS.map((m) => ({
  value: m,
  label: MUSCLE_GROUP_LABELS[m],
}));

const SETS_OPTIONS: SelectOption<string>[] = Array.from(
  { length: SETS_MAX - SETS_MIN + 1 },
  (_, i) => ({ value: String(SETS_MIN + i), label: String(SETS_MIN + i) }),
);

type OnOff = 'on' | 'off';
const PER_SET_OPTIONS: ChipOption<OnOff>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
];

export interface ExerciseFieldsProps {
  form: ExerciseForm;
  errors: ExerciseFormErrors;
  onChange: (form: ExerciseForm) => void;
  /** Creating a new exercise: choosing a type fills in its defaults (SPEC 4.1). */
  creating: boolean;
}

/** The editable fields of a library exercise, shared by "New exercise" and its edit page. */
export function ExerciseFields({ form, errors, onChange, creating }: ExerciseFieldsProps) {
  const set = (patch: Partial<ExerciseForm>) => onChange({ ...form, ...patch });
  const reps = (text: string) => sanitizeNumberText(text, 'numeric');

  return (
    <Stack gap="md">
      <TextInput
        label="Name"
        value={form.name}
        error={errors.name}
        autoComplete="off"
        autoCapitalize="sentences"
        onValueChange={(name) => set({ name })}
      />
      <Stack gap="xs">
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          value={form.type}
          onValueChange={(type) => onChange(withType(form, type, creating))}
        />
        {creating && (
          <Text as="p" variant="caption" tone="tertiary">
            Choosing a type fills in its rep range and rest. Both stay editable.
          </Text>
        )}
      </Stack>
      <Select
        label="Muscle group"
        options={MUSCLE_OPTIONS}
        value={form.muscleGroup}
        onValueChange={(muscleGroup) => set({ muscleGroup })}
      />
      <Inline gap="sm" align="start">
        <Grow>
          <TextInput
            label="Min reps"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={form.repMin}
            error={errors.repMin}
            onValueChange={(text) => set({ repMin: reps(text) })}
          />
        </Grow>
        <Grow>
          <TextInput
            label="Max reps"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={form.repMax}
            error={errors.repMax}
            onValueChange={(text) => set({ repMax: reps(text) })}
          />
        </Grow>
      </Inline>
      <Inline gap="sm" align="start">
        <Grow>
          <Select
            label="Sets"
            options={SETS_OPTIONS}
            value={String(form.sets)}
            onValueChange={(v) => set({ sets: Number(v) })}
          />
        </Grow>
        <Grow>
          <Select
            label="Rest"
            options={restOptions(form.restSeconds)}
            value={String(form.restSeconds)}
            onValueChange={(v) => set({ restSeconds: Number(v) })}
          />
        </Grow>
      </Inline>
      <Stack gap="xs">
        <Text variant="body-sm" tone="subtle">
          Per-set weight
        </Text>
        <ChipGroup
          label="Per-set weight"
          options={PER_SET_OPTIONS}
          value={form.perSetWeight ? 'on' : 'off'}
          onChange={(v) => set({ perSetWeight: v === 'on' })}
        />
        <Text as="p" variant="caption" tone="tertiary">
          On gives every set its own weight field on Today.
        </Text>
      </Stack>
    </Stack>
  );
}
