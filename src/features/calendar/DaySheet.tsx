import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  addLoggedEntry,
  createPastSession,
  deleteEntry,
  deleteSession,
  updateEntry,
} from '../../data';
import type { Exercise, LogEntry, Session, Unit } from '../../domain';
import {
  Badge,
  Button,
  ChipGroup,
  ConfirmDialog,
  Icon,
  Inline,
  ListGroup,
  ListItem,
  ListRow,
  NumberInput,
  Sheet,
  Stack,
  Text,
} from '../../ui';
import {
  activeExercises,
  dayTitle,
  daySheetMode,
  exerciseCount,
  orderedWorkouts,
  plannedDetail,
  sessionRows,
  type CalendarDayModel,
} from './calendarModel';
import {
  blankForm,
  canSave,
  entryDetail,
  entryPatch,
  formFromEntry,
  newEntryInput,
  usesPerSetWeight,
  variantOptions,
  type EntryForm,
} from './entryForm';
import type { CalendarData } from './useCalendarData';
import styles from './Calendar.module.css';

/** Editing an entry, or logging a workout exercise after the fact. */
interface EditorState {
  kind: 'edit' | 'add';
  session: Session;
  exercise: Exercise;
  /** The entry being edited (null when adding). */
  entry: LogEntry | null;
  initial: EntryForm;
  form: EntryForm;
  perSet: boolean;
}

type Confirm =
  { kind: 'session'; session: Session } | { kind: 'entry'; entry: LogEntry; exercise: Exercise };

export interface DaySheetProps {
  day: CalendarDayModel;
  data: CalendarData;
  onClose: () => void;
}

/**
 * One day's sheet. A day with sessions lists their entries, each editable and
 * deletable; a past day with none offers to add one; today without a session
 * and future days show the plan, read-only.
 */
export function DaySheet({ day, data, onClose }: DaySheetProps) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const saving = useRef(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const title = dayTitle(day.date);

  // Switching between the day and the editor moves focus into the new view.
  const viewKey = editor ? `${editor.kind}:${editor.entry?.id ?? editor.exercise.id}` : 'day';
  const lastView = useRef(viewKey);
  useEffect(() => {
    if (lastView.current === viewKey) return;
    lastView.current = viewKey;
    viewRef.current?.focus();
  }, [viewKey]);

  function editEntry(session: Session, entry: LogEntry, exercise: Exercise) {
    const initial = formFromEntry(entry, exercise, data.unit);
    const perSet = usesPerSetWeight(exercise, entry);
    setEditor({ kind: 'edit', session, exercise, entry, initial, form: initial, perSet });
  }

  function logMissing(session: Session, exercise: Exercise) {
    const initial = blankForm(exercise);
    const perSet = exercise.perSetWeight;
    setEditor({ kind: 'add', session, exercise, entry: null, initial, form: initial, perSet });
  }

  function changeForm(change: (form: EntryForm) => EntryForm) {
    setEditor((current) => current && { ...current, form: change(current.form) });
  }

  async function save(state: EditorState) {
    if (saving.current || !canSave(state.form)) return;
    saving.current = true;
    try {
      if (state.entry) {
        await updateEntry(
          state.entry.id,
          entryPatch(state.entry, state.initial, state.form, state.perSet, data.unit),
        );
      } else {
        await addLoggedEntry(
          newEntryInput(state.session.id, state.exercise, state.form, state.perSet, data.unit),
        );
      }
      setEditor(null);
    } catch (error) {
      console.error(error);
    } finally {
      saving.current = false;
    }
  }

  function confirmDelete() {
    if (!confirm) return;
    setConfirm(null);
    setEditor(null);
    const done =
      confirm.kind === 'session'
        ? deleteSession(confirm.session.id)
        : deleteEntry(confirm.entry.id);
    done.catch((error: unknown) => console.error(error));
  }

  let sheetTitle = title;
  let body: ReactNode;
  let footer: ReactNode;
  if (editor) {
    sheetTitle = editor.exercise.name;
    body = (
      <EditorBody
        state={editor}
        date={day.date}
        unit={data.unit}
        onChange={changeForm}
        onDelete={() => {
          if (editor.entry) {
            setConfirm({ kind: 'entry', entry: editor.entry, exercise: editor.exercise });
          }
        }}
      />
    );
    footer = (
      <>
        <Button
          variant="primary"
          fullWidth
          disabled={!canSave(editor.form)}
          onClick={() => void save(editor)}
        >
          {editor.kind === 'edit' ? 'Save' : 'Log'}
        </Button>
        <Button variant="tertiary" fullWidth onClick={() => setEditor(null)}>
          Cancel
        </Button>
      </>
    );
  } else {
    const mode = daySheetMode(day);
    body =
      mode === 'sessions' ? (
        <Stack gap="xl">
          {day.sessions.map((session) => (
            <SessionBlock
              key={session.id}
              session={session}
              data={data}
              onEdit={(entry, exercise) => editEntry(session, entry, exercise)}
              onLog={(exercise) => logMissing(session, exercise)}
              onDelete={() => setConfirm({ kind: 'session', session })}
            />
          ))}
        </Stack>
      ) : mode === 'add' ? (
        <AddSession day={day} data={data} />
      ) : (
        <Planned day={day} data={data} />
      );
  }

  return (
    <>
      <Sheet open onClose={onClose} title={sheetTitle} footer={footer}>
        <div ref={viewRef} tabIndex={-1} className={styles.view}>
          {body}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm !== null}
        tone="destructive"
        title={confirm?.kind === 'session' ? 'Delete this session?' : 'Delete this entry?'}
        message={
          confirm?.kind === 'session'
            ? `${confirm.session.workoutName} on ${title} and everything logged in it will be removed. The cycle does not change.`
            : confirm
              ? `${confirm.exercise.name} on ${title} will be removed from your history.`
              : ''
        }
        confirmLabel={confirm?.kind === 'session' ? 'Delete session' : 'Delete entry'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

interface SessionBlockProps {
  session: Session;
  data: CalendarData;
  onEdit: (entry: LogEntry, exercise: Exercise) => void;
  onLog: (exercise: Exercise) => void;
  onDelete: () => void;
}

/** A session's heading, its exercises (tap to edit or log), and Delete session. */
function SessionBlock({ session, data, onEdit, onLog, onDelete }: SessionBlockProps) {
  const headingId = useId();
  const workout = data.workoutsById.get(session.workoutId);
  const entries = data.entries.filter((e) => e.sessionId === session.id);
  const rows = sessionRows(workout, entries, data.exercisesById);

  return (
    <section aria-labelledby={headingId}>
      <Stack gap="xs">
        <Inline gap="xs" wrap>
          <Text as="h3" id={headingId} variant="body-lg" weight="medium">
            {session.workoutName}
          </Text>
          {session.deload && <Badge>Deload</Badge>}
          {session.status === 'inProgress' && <Badge>In progress</Badge>}
        </Inline>
        {rows.length === 0 ? (
          <Text as="p" variant="body-sm" tone="subtle">
            Nothing logged in this session.
          </Text>
        ) : (
          <ListGroup label={`${session.workoutName} exercises`}>
            {rows.map((row) => {
              if (row.kind === 'missing') {
                const exercise = data.exercisesById.get(row.exerciseId)!;
                return (
                  <ListItem key={`missing-${row.exerciseId}`}>
                    <ListRow
                      title={exercise.name}
                      detail="Not logged"
                      chevron
                      ariaLabel={`${exercise.name}, Not logged`}
                      onClick={() => onLog(exercise)}
                    />
                  </ListItem>
                );
              }
              const exercise = data.exercisesById.get(row.entry.exerciseId);
              const name = exercise?.name ?? 'Exercise';
              const detail = entryDetail(row.entry, exercise, data.unit);
              return (
                <ListItem key={row.entry.id}>
                  <ListRow
                    title={name}
                    detail={detail}
                    chevron={exercise !== undefined}
                    ariaLabel={`${name}, ${detail}`}
                    onClick={exercise ? () => onEdit(row.entry, exercise) : undefined}
                  />
                </ListItem>
              );
            })}
          </ListGroup>
        )}
        <div className={styles.destructive}>
          <Button variant="destructive" fullWidth onClick={onDelete}>
            Delete session
          </Button>
        </div>
      </Stack>
    </section>
  );
}

/** A past day with no session: pick a workout to add one (finished; the cycle stays put). */
function AddSession({ day, data }: { day: CalendarDayModel; data: CalendarData }) {
  const creating = useRef(false);
  const workouts = orderedWorkouts(data.workouts, data.cycle.items);

  async function add(workoutId: string) {
    if (creating.current) return;
    creating.current = true;
    try {
      await createPastSession(day.date, workoutId);
    } catch (error) {
      creating.current = false;
      console.error(error);
    }
  }

  return (
    <Stack gap="md">
      <Text as="p" variant="body-sm" tone="subtle">
        Nothing logged on this day. Add a session to log a workout after the fact.
      </Text>
      {workouts.length === 0 ? (
        <Text as="p" variant="body-sm" tone="subtle">
          Create a workout in Settings first.
        </Text>
      ) : (
        <ListGroup label="Workouts">
          {workouts.map((workout) => (
            <ListItem key={workout.id}>
              <ListRow
                title={workout.name}
                detail={exerciseCount(activeExercises(workout, data.exercisesById).length)}
                trailing={<Icon name="plus" />}
                ariaLabel={`Add ${workout.name}`}
                onClick={() => void add(workout.id)}
              />
            </ListItem>
          ))}
        </ListGroup>
      )}
    </Stack>
  );
}

/** Today without a session, or a future day: the planned workout, read-only. */
function Planned({ day, data }: { day: CalendarDayModel; data: CalendarData }) {
  const item = day.planned?.item;
  if (item?.kind === 'workout') {
    const workout = data.workoutsById.get(item.workoutId);
    const name = workout?.name ?? 'Workout';
    const exercises = activeExercises(workout, data.exercisesById);
    return (
      <Stack gap="xs">
        <Inline gap="xs" align="baseline" wrap>
          <Text as="h3" variant="body-lg" weight="medium">
            {name}
          </Text>
          <Text variant="caption" tone="subtle">
            Planned
          </Text>
        </Inline>
        {exercises.length === 0 ? (
          <Text as="p" variant="body-sm" tone="subtle">
            No exercises in this workout yet.
          </Text>
        ) : (
          <ListGroup label={`${name} exercises`}>
            {exercises.map((exercise) => (
              <ListItem key={exercise.id}>
                <ListRow title={exercise.name} detail={plannedDetail(exercise)} />
              </ListItem>
            ))}
          </ListGroup>
        )}
      </Stack>
    );
  }
  if (item?.kind === 'rest') {
    const restartOn = day.planned?.waiting ? data.cycle.restartOn : null;
    return (
      <Stack gap="xxs">
        <Text as="p" variant="body-lg" weight="medium">
          Rest day
        </Text>
        {restartOn && (
          <Text as="p" variant="body-sm" tone="subtle">
            The cycle restarts on {dayTitle(restartOn)}.
          </Text>
        )}
      </Stack>
    );
  }
  return (
    <Stack gap="xxs">
      <Text as="p" variant="body" tone="muted">
        Nothing planned
      </Text>
      {data.cycle.items.length === 0 && (
        <Text as="p" variant="body-sm" tone="subtle">
          Add workouts to the cycle in Settings.
        </Text>
      )}
    </Stack>
  );
}

interface EditorBodyProps {
  state: EditorState;
  date: string;
  unit: Unit;
  onChange: (change: (form: EntryForm) => EntryForm) => void;
  onDelete: () => void;
}

/** Variant chips, weight (or per-set weights), and reps per set. */
function EditorBody({ state, date, unit, onChange, onDelete }: EditorBodyProps) {
  const { form, perSet } = state;
  const options = variantOptions(state.exercise, form.variantId);
  const setField = (key: 'reps' | 'setWeights', index: number, value: string) =>
    onChange((current) => {
      const values = [...current[key]];
      values[index] = value;
      return { ...current, [key]: values };
    });

  return (
    <Stack gap="md">
      <Text as="p" variant="body-sm" tone="subtle">
        {state.session.workoutName} · {dayTitle(date)}
      </Text>
      {options.length > 1 && (
        <ChipGroup
          label="Variant"
          options={options.map((v) => ({ value: v.id, label: v.name }))}
          value={form.variantId}
          onChange={(variantId) => onChange((current) => ({ ...current, variantId }))}
        />
      )}
      {perSet ? (
        <div className={styles.inputsPerSet}>
          {form.reps.map((reps, i) => (
            <Fragment key={i}>
              <NumberInput
                label={`Set ${i + 1} weight`}
                placeholder="Weight"
                mode="decimal"
                unit={unit}
                value={form.setWeights[i] ?? ''}
                onValueChange={(value) => setField('setWeights', i, value)}
              />
              <NumberInput
                label={`Set ${i + 1} reps`}
                placeholder={`Set ${i + 1}`}
                mode="numeric"
                value={reps}
                onValueChange={(value) => setField('reps', i, value)}
              />
            </Fragment>
          ))}
        </div>
      ) : (
        <div className={styles.inputs}>
          <NumberInput
            className={styles.weight}
            label="Weight"
            mode="decimal"
            unit={unit}
            value={form.weight}
            onValueChange={(weight) => onChange((current) => ({ ...current, weight }))}
          />
          {form.reps.map((reps, i) => (
            <NumberInput
              key={i}
              className={styles.reps}
              label={`Set ${i + 1} reps`}
              placeholder={`Set ${i + 1}`}
              mode="numeric"
              value={reps}
              onValueChange={(value) => setField('reps', i, value)}
            />
          ))}
        </div>
      )}
      {state.kind === 'edit' && (
        <div className={styles.destructive}>
          <Button variant="destructive" fullWidth onClick={onDelete}>
            Delete entry
          </Button>
        </div>
      )}
    </Stack>
  );
}
