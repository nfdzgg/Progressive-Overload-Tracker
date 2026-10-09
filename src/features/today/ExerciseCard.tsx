import { Fragment, useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { logEntry, reopenEntry, saveDraft, type EntryInput, type LogResult } from '../../data';
import {
  computeTarget,
  findReference,
  formatEntrySummary,
  prefillFromReference,
  prsForLoggedEntry,
  type Exercise,
  type LogEntry,
  type Session,
  type Variant,
} from '../../domain';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ChipGroup,
  Inline,
  NumberInput,
  parseNumberText,
  Stack,
  Text,
} from '../../ui';
import { useTodayExtensions, type TodayCardContext } from './extensions';
import {
  activeVariants,
  canLog,
  entryValues,
  initialForm,
  pickVariantId,
  repPlaceholder,
  targetLabel,
  withVariant,
  type CardForm,
} from './todayModel';
import { useCollapseMotion } from './useCollapseMotion';
import type { TodayData } from './useTodayData';
import styles from './ExerciseCard.module.css';

export interface ExerciseCardProps {
  data: TodayData;
  workoutId: string;
  /** null until the first interaction creates the session. */
  session: Session | null;
  /** The workout's exercise this card stands for. */
  slotExerciseId: string;
  /** This slot's entry in the session, if any. */
  entry: LogEntry | undefined;
  ensureSession: () => Promise<Session>;
}

function variantOf(exercise: Exercise, variantId: string): Variant {
  return exercise.variants.find((v) => v.id === variantId) ?? exercise.variants[0];
}

/**
 * One exercise on Today: name, variant chips, reference and target, and the
 * input row with Log. A logged (or skipped) card collapses to its done state;
 * tapping it reopens it for editing.
 */
export function ExerciseCard(props: ExerciseCardProps) {
  const { data, slotExerciseId, entry } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const done = entry?.status === 'logged' || entry?.status === 'skipped';
  useCollapseMotion(cardRef, done);

  // After a swap the entry is for the exercise actually performed.
  const exercise =
    data.exercisesById.get(entry?.exerciseId ?? slotExerciseId) ??
    data.exercisesById.get(slotExerciseId);
  if (!exercise) return null;

  return (
    <Card
      ref={cardRef}
      as="article"
      aria-labelledby={titleId}
      variant={done ? 'exercise-done' : 'exercise'}
      className={done ? styles.doneCard : undefined}
    >
      {done && entry ? (
        <DoneContent {...props} entry={entry} exercise={exercise} titleId={titleId} />
      ) : (
        <CardEditor key={exercise.id} {...props} exercise={exercise} titleId={titleId} />
      )}
    </Card>
  );
}

interface ContentProps extends ExerciseCardProps {
  exercise: Exercise;
  titleId: string;
}

/** Header actions from Session extras, kept above the done card's reopen button. */
function HeaderActions(context: TodayCardContext): ReactNode {
  const { CardHeaderActions } = useTodayExtensions();
  if (!CardHeaderActions) return null;
  return (
    <span className={styles.actions}>
      <CardHeaderActions {...context} />
    </span>
  );
}

function useHasHeaderActions(): boolean {
  return useTodayExtensions().CardHeaderActions !== undefined;
}

function DoneContent(props: ContentProps & { entry: LogEntry }) {
  const { data, exercise, entry, titleId, session, workoutId, slotExerciseId, ensureSession } =
    props;
  const hasActions = useHasHeaderActions();
  const skipped = entry.status === 'skipped';
  const prs = skipped ? [] : prsForLoggedEntry(entry, data.entries, data.sessionsById, exercise);
  const variant = variantOf(exercise, pickVariantId(exercise, entry.variantId));

  return (
    <>
      <Stack gap="xs">
        <CardHeader
          title={exercise.name}
          titleId={titleId}
          subdued
          actions={
            hasActions ? (
              <HeaderActions
                session={session}
                workoutId={workoutId}
                slotExerciseId={slotExerciseId}
                exercise={exercise}
                variant={variant}
                entry={entry}
                ensureSession={ensureSession}
              />
            ) : undefined
          }
        />
        <Inline gap="xs" wrap>
          <Text variant="body-sm" tone="subtle">
            {skipped ? 'Skipped' : formatEntrySummary(entry, data.unit)}
          </Text>
          {prs.length > 0 && <Badge tone="success">PR</Badge>}
        </Inline>
      </Stack>
      <button
        type="button"
        className={styles.reopen}
        aria-label={`Edit ${exercise.name}`}
        onClick={() => void reopenEntry(entry.id)}
      />
    </>
  );
}

function CardEditor(props: ContentProps) {
  const { data, exercise, entry, session, slotExerciseId, workoutId, ensureSession, titleId } =
    props;
  const extensions = useTodayExtensions();
  const hasActions = extensions.CardHeaderActions !== undefined;
  const sessionId = session?.id;

  const referenceFor = useCallback(
    (variantId: string) =>
      findReference(data.entries, data.sessionsById, exercise.id, variantId, {
        excludeSessionId: sessionId,
      }),
    [data.entries, data.sessionsById, exercise.id, sessionId],
  );
  const prefillFor = (variantId: string) =>
    prefillFromReference(referenceFor(variantId), exercise, data.unit);

  // Local input state, so typing never jumps while drafts save in the background.
  const [form, setForm] = useState<CardForm>(() =>
    initialForm(exercise, entry, data.unit, prefillFor),
  );
  const formRef = useRef(form);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const hasDraft = useRef(entry !== undefined);
  const closed = useRef(false);
  const valueOnFocus = useRef<string | null>(null);

  const variants = activeVariants(exercise);
  const variantId = pickVariantId(exercise, form.variantId);
  const variant = variantOf(exercise, variantId);
  const reference = referenceFor(variantId);
  const target = computeTarget(reference, exercise.repMax);
  const prefill = prefillFromReference(reference, exercise, data.unit);
  const targetText = targetLabel(target);

  /** Saves run one after another, each with the latest inputs. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.current.then(task);
    queue.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function toInput(id: string, values: CardForm): EntryInput {
    return {
      sessionId: id,
      slotExerciseId,
      exerciseId: exercise.id,
      variantId: pickVariantId(exercise, values.variantId),
      unit: data.unit,
      ...entryValues(values, exercise),
    };
  }

  function setLocal(next: CardForm) {
    formRef.current = next;
    setForm(next);
  }

  /** Typing saves a draft immediately, so closing the app loses nothing. */
  function update(next: CardForm) {
    setLocal(next);
    if (closed.current) return;
    hasDraft.current = true;
    enqueue(async () => {
      const current = await ensureSession();
      await saveDraft(toInput(current.id, formRef.current));
    }).catch((error: unknown) => console.error(error));
  }

  function changeVariant(id: string) {
    const next = withVariant(formRef.current, exercise, id, prefillFor(id));
    if (hasDraft.current || entry) update(next);
    else setLocal(next);
  }

  async function log() {
    if (closed.current || !canLog(formRef.current)) return;
    closed.current = true;
    let result: LogResult;
    try {
      result = await enqueue(async () => {
        const current = await ensureSession();
        return logEntry(toInput(current.id, formRef.current), data.today);
      });
    } catch (error) {
      closed.current = false;
      console.error(error);
      return;
    }
    extensions.onEntryLogged?.({
      exercise,
      entry: result.entry,
      restSeconds: exercise.restSeconds,
      prs: result.prs,
    });
  }

  function commitSet(index: number) {
    const value = formRef.current.reps[index] ?? '';
    const changed = value !== valueOnFocus.current;
    valueOnFocus.current = null;
    if (index >= exercise.sets - 1 || !changed || (parseNumberText(value) ?? 0) <= 0) return;
    extensions.onSetCommitted?.({ exercise, setIndex: index, restSeconds: exercise.restSeconds });
  }

  const setField = (key: 'reps' | 'setWeights', index: number, value: string) => {
    const values = [...formRef.current[key]];
    values[index] = value;
    update({ ...formRef.current, [key]: values });
  };

  const perSet = exercise.perSetWeight;

  return (
    <Stack gap="sm">
      <CardHeader
        title={exercise.name}
        titleId={titleId}
        actions={
          hasActions ? (
            <HeaderActions
              session={session}
              workoutId={workoutId}
              slotExerciseId={slotExerciseId}
              exercise={exercise}
              variant={variant}
              entry={entry}
              ensureSession={ensureSession}
            />
          ) : undefined
        }
      />
      {variants.length > 1 && (
        <ChipGroup
          label="Variant"
          options={variants.map((v) => ({ value: v.id, label: v.name }))}
          value={variantId}
          onChange={changeVariant}
        />
      )}
      {reference ? (
        <Text as="p" variant="body-sm" tone="muted" className={styles.reference}>
          <span>Last: {formatEntrySummary(reference, data.unit)}</span>
          {target.kind === 'addWeight' ? (
            <Badge tone="success">{targetText}</Badge>
          ) : (
            <span>· {targetText}</span>
          )}
        </Text>
      ) : (
        <Text as="p" variant="body-sm" tone="tertiary">
          Nothing logged this way yet
        </Text>
      )}
      <div className={perSet ? styles.rowPerSet : styles.row}>
        {!perSet && (
          <NumberInput
            className={styles.weight}
            label="Weight"
            mode="decimal"
            unit={data.unit}
            value={form.weight}
            onValueChange={(value) => update({ ...formRef.current, weight: value })}
          />
        )}
        {form.reps.map((reps, i) => (
          <Fragment key={i}>
            {perSet && (
              <NumberInput
                className={styles.setWeight}
                label={`Set ${i + 1} weight`}
                placeholder="Weight"
                mode="decimal"
                unit={data.unit}
                value={form.setWeights[i] ?? ''}
                onValueChange={(value) => setField('setWeights', i, value)}
              />
            )}
            <NumberInput
              label={`Set ${i + 1} reps`}
              placeholder={repPlaceholder(prefill, i)}
              mode="numeric"
              value={reps}
              onValueChange={(value) => setField('reps', i, value)}
              onFocus={() => {
                valueOnFocus.current = formRef.current.reps[i] ?? '';
              }}
              onBlur={() => commitSet(i)}
            />
          </Fragment>
        ))}
        <Button
          variant="primary"
          className={perSet ? styles.logPerSet : styles.log}
          aria-label={`Log ${exercise.name}`}
          disabled={!canLog(form)}
          onClick={() => void log()}
        >
          Log
        </Button>
      </div>
    </Stack>
  );
}
