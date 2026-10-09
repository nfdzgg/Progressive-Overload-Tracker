// View-model for the Progress dashboard (SPEC 5.4–5.7, 6.5). Every number
// comes from the rules in src/domain; this file only selects, orders, and
// labels them for the cards and charts.
import {
  addDays,
  computePrEvents,
  currentStreak,
  daysBetween,
  eligibleHistory,
  entryBestReps,
  entryE1rm,
  entryTopWeight,
  findStalled,
  formatDate,
  formatEntrySummary,
  formatWeight,
  hardSetsByMuscle,
  isWeightedEntry,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  PR_KIND_LABELS,
  recentWeekStarts,
  sessionsPerWeek,
  sortChronologically,
  totalHardSets,
  weeklyVolume,
  weekStart,
  convertWeight,
  type Exercise,
  type ISODate,
  type LogEntry,
  type PrEvent,
  type PrKind,
  type Session,
  type Unit,
} from '../../domain';
import type { Bar, ChartPoint, ComparisonRow, LineSeries } from '../../ui';
import { formatE1rm, rangeStart, shortDate, weekLabel, type Range } from './progressFormat';

/** Weeks shown in the consistency and volume charts. */
export const WEEKS = 8;
/** Rows in the Recent PRs list. */
export const RECENT_PR_LIMIT = 10;

export interface ProgressData {
  entries: LogEntry[];
  sessions: Session[];
  /** All exercises, archived included (history keeps their names). */
  exercises: Exercise[];
  unit: Unit;
  today: ISODate;
}

export interface ProgressContext extends ProgressData {
  sessionById: Map<string, Session>;
  exerciseById: Map<string, Exercise>;
  entryById: Map<string, LogEntry>;
  /** Logged entries only, oldest first. */
  logged: LogEntry[];
  /** Every PR event (deloads excluded by the domain), oldest first. */
  prEvents: PrEvent[];
  prEntryIds: Set<string>;
  /** Monday of the current week. */
  weekStart: ISODate;
}

export function buildContext(data: ProgressData): ProgressContext {
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
  const prEvents = computePrEvents(data.entries, sessionById, exerciseById);
  return {
    ...data,
    sessionById,
    exerciseById,
    entryById: new Map(data.entries.map((e) => [e.id, e])),
    logged: sortChronologically(data.entries.filter((e) => e.status === 'logged')),
    prEvents,
    prEntryIds: new Set(prEvents.map((e) => e.entryId)),
    weekStart: weekStart(data.today),
  };
}

/** Anything to show at all: a logged entry or a finished session. */
export function hasAnyData(ctx: ProgressContext): boolean {
  return ctx.logged.length > 0 || hasFinishedSessions(ctx);
}

export function hasFinishedSessions(ctx: ProgressContext): boolean {
  return ctx.sessions.some((s) => s.status === 'finished');
}

// ---------- 1. This week ----------

export interface ThisWeek {
  sessions: number;
  prs: number;
  hardSets: number;
}

export function thisWeek(ctx: ProgressContext): ThisWeek {
  const end = addDays(ctx.weekStart, 6);
  return {
    sessions: sessionsPerWeek(ctx.sessions, ctx.today, 1)[0].count,
    prs: ctx.prEvents.filter((e) => e.date >= ctx.weekStart && e.date <= end).length,
    hardSets: totalHardSets(hardSetsByMuscle(ctx.entries, ctx.exerciseById, ctx.weekStart)),
  };
}

// ---------- 2. Consistency ----------

export interface Consistency {
  bars: Bar[];
  streak: number;
}

export function consistency(ctx: ProgressContext): Consistency {
  return {
    bars: sessionsPerWeek(ctx.sessions, ctx.today, WEEKS).map((w) => ({
      label: weekLabel(w.weekStart),
      value: w.count,
      current: w.weekStart === ctx.weekStart,
    })),
    streak: currentStreak(ctx.sessions, ctx.today),
  };
}

// ---------- 3. Sets per muscle group ----------

export interface MuscleSets {
  /** Groups with sets in either week, in muscle-group order. */
  rows: ComparisonRow[];
  current: number;
  previous: number;
}

export function muscleSets(ctx: ProgressContext): MuscleSets {
  const current = hardSetsByMuscle(ctx.entries, ctx.exerciseById, ctx.weekStart);
  const previous = hardSetsByMuscle(ctx.entries, ctx.exerciseById, addDays(ctx.weekStart, -7));
  return {
    rows: MUSCLE_GROUPS.filter((m) => current[m] > 0 || previous[m] > 0).map((m) => ({
      label: MUSCLE_GROUP_LABELS[m],
      current: current[m],
      previous: previous[m],
    })),
    current: totalHardSets(current),
    previous: totalHardSets(previous),
  };
}

// ---------- 4. Recent PRs ----------

export interface PrRow {
  id: string;
  exercise: string;
  variant: string;
  kind: string;
  value: string;
  date: string;
}

const KIND_ORDER: Record<PrKind, number> = { weight: 0, reps: 1, e1rm: 2 };

function names(ctx: ProgressContext, exerciseId: string, variantId: string) {
  const exercise = ctx.exerciseById.get(exerciseId);
  const variant = exercise?.variants.find((v) => v.id === variantId);
  return { exercise, variant };
}

function prValue(event: PrEvent, unit: Unit): string {
  if (event.kind === 'weight') return formatWeight(event.weight, event.unit, unit);
  if (event.kind === 'reps')
    return `${formatWeight(event.weight, event.unit, unit)} × ${event.reps}`;
  return formatE1rm(convertWeight(event.e1rm ?? 0, event.unit, unit), unit);
}

/** The latest PRs, newest first (same-day entries by when they were logged). */
export function recentPrs(ctx: ProgressContext, limit = RECENT_PR_LIMIT): PrRow[] {
  const createdAt = (e: PrEvent) => ctx.entryById.get(e.entryId)?.createdAt ?? 0;
  return [...ctx.prEvents]
    .sort((a, b) =>
      a.date !== b.date
        ? a.date < b.date
          ? 1
          : -1
        : createdAt(b) - createdAt(a) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
    )
    .slice(0, limit)
    .map((event) => {
      const { exercise, variant } = names(ctx, event.exerciseId, event.variantId);
      return {
        id: `${event.entryId}-${event.kind}`,
        exercise: exercise?.name ?? '',
        variant: variant?.name ?? '',
        kind: PR_KIND_LABELS[event.kind],
        value: prValue(event, ctx.unit),
        date: formatDate(event.date),
      };
    });
}

// ---------- 5. Stalled ----------

export interface StalledRow {
  id: string;
  exerciseId: string;
  variantId: string;
  exercise: string;
  variant: string;
}

/** Stalled pairs (5.6) of active exercises and variants, by name. */
export function stalledRows(ctx: ProgressContext): StalledRow[] {
  const rows: StalledRow[] = [];
  for (const ref of findStalled(ctx.entries, ctx.sessionById, ctx.unit)) {
    const { exercise, variant } = names(ctx, ref.exerciseId, ref.variantId);
    if (!exercise || !variant || exercise.archived || variant.archived) continue;
    rows.push({
      id: `${ref.exerciseId}|${ref.variantId}`,
      ...ref,
      exercise: exercise.name,
      variant: variant.name,
    });
  }
  return rows.sort(
    (a, b) => a.exercise.localeCompare(b.exercise) || a.variant.localeCompare(b.variant),
  );
}

// ---------- 6. Exercise detail ----------

export interface Option {
  value: string;
  label: string;
}

export interface Selection {
  exerciseId: string;
  variantId: string;
}

const archivedLabel = (name: string, archived: boolean) => (archived ? `${name} (archived)` : name);

/** Logged entries whose exercise and variant are known (the ones detail can show). */
function knownEntries(ctx: ProgressContext): LogEntry[] {
  return ctx.logged.filter((e) =>
    ctx.exerciseById.get(e.exerciseId)?.variants.some((v) => v.id === e.variantId),
  );
}

/** Exercises with logged history (archived ones labelled), by name. */
export function exerciseOptions(ctx: ProgressContext): Option[] {
  const ids = new Set(knownEntries(ctx).map((e) => e.exerciseId));
  return ctx.exercises
    .filter((e) => ids.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ value: e.id, label: archivedLabel(e.name, e.archived) }));
}

/** Variants of the exercise with logged history, in the exercise's order. */
export function variantOptions(ctx: ProgressContext, exerciseId: string): Option[] {
  const exercise = ctx.exerciseById.get(exerciseId);
  if (!exercise) return [];
  const ids = new Set(
    ctx.logged.filter((e) => e.exerciseId === exerciseId).map((e) => e.variantId),
  );
  return exercise.variants
    .filter((v) => ids.has(v.id))
    .map((v) => ({ value: v.id, label: archivedLabel(v.name, v.archived) }));
}

/**
 * A valid selection: the wanted exercise and variant while they have
 * history; otherwise the exercise of the latest logged entry, and the
 * exercise's most recently logged variant. Null when nothing is logged.
 */
export function resolveSelection(
  ctx: ProgressContext,
  wanted: Partial<Selection>,
): Selection | null {
  const exercises = exerciseOptions(ctx);
  if (exercises.length === 0) return null;
  const latest = knownEntries(ctx).at(-1);
  const exerciseId = exercises.some((o) => o.value === wanted.exerciseId)
    ? wanted.exerciseId!
    : (latest?.exerciseId ?? exercises[0].value);
  const variants = variantOptions(ctx, exerciseId);
  const latestVariant = ctx.logged
    .filter((e) => e.exerciseId === exerciseId && variants.some((v) => v.value === e.variantId))
    .at(-1)?.variantId;
  const variantId = variants.some((v) => v.value === wanted.variantId)
    ? wanted.variantId!
    : (latestVariant ?? variants[0].value);
  return { exerciseId, variantId };
}

/** Logged entries of one exercise + variant (deloads included), oldest first. */
function variantHistory(ctx: ProgressContext, sel: Selection): LogEntry[] {
  return ctx.logged.filter((e) => e.exerciseId === sel.exerciseId && e.variantId === sel.variantId);
}

const isDeload = (ctx: ProgressContext, entry: LogEntry) =>
  ctx.sessionById.get(entry.sessionId)?.deload === true;

// Chart x values are whole days since a fixed Monday, so spacing follows time.
const X_EPOCH: ISODate = '2000-01-03';

export function chartDateLabel(x: number): string {
  return shortDate(addDays(X_EPOCH, x));
}

export interface DetailChart {
  /** e1RM for weighted variants; best reps when nothing was ever weighted (5.4). */
  metric: 'e1rm' | 'reps';
  series: LineSeries[];
}

export function detailChart(ctx: ProgressContext, sel: Selection, range: Range): DetailChart {
  const history = variantHistory(ctx, sel);
  const weighted = history.some(isWeightedEntry);
  const start = rangeStart(ctx.today, range);
  const shown = start ? history.filter((e) => e.date >= start) : history;

  const point = (entry: LogEntry, y: number, text: string, markPr: boolean): ChartPoint => {
    const deload = isDeload(ctx, entry);
    const pr = markPr && ctx.prEntryIds.has(entry.id);
    const flags = `${pr ? ' · PR' : ''}${deload ? ' · Deload' : ''}`;
    return {
      x: daysBetween(X_EPOCH, entry.date),
      y,
      highlight: pr || undefined,
      muted: deload || undefined,
      label: `${shortDate(entry.date)} · ${text}${flags}`,
    };
  };

  const series = (
    id: string,
    name: string,
    tone: LineSeries['tone'],
    value: (e: LogEntry) => number | null,
    text: (v: number) => string,
    markPr: boolean,
  ): LineSeries => ({
    id,
    name,
    tone,
    points: shown.flatMap((entry) => {
      const v = value(entry);
      return v === null ? [] : [point(entry, v, text(v), markPr)];
    }),
  });

  if (!weighted) {
    return {
      metric: 'reps',
      series: [series('reps', 'Best reps', 'primary', entryBestReps, (v) => `${v} reps`, true)],
    };
  }
  return {
    metric: 'e1rm',
    series: [
      series(
        'e1rm',
        'e1RM',
        'primary',
        (e) => entryE1rm(e, ctx.unit),
        (v) => formatE1rm(v, ctx.unit),
        true,
      ),
      series(
        'top',
        'Top weight',
        'secondary',
        (e) => entryTopWeight(e, ctx.unit),
        (v) => formatWeight(v, ctx.unit, ctx.unit),
        false,
      ),
    ],
  };
}

/** Key value for the selected variant: best e1RM (or best reps), deloads excluded. */
export function detailBest(
  ctx: ProgressContext,
  sel: Selection,
): { label: string; value: string } | null {
  const weighted = variantHistory(ctx, sel).some(isWeightedEntry);
  const eligible = eligibleHistory(ctx.entries, ctx.sessionById, sel.exerciseId, sel.variantId);
  const values = eligible
    .map((e) => (weighted ? entryE1rm(e, ctx.unit) : entryBestReps(e)))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const best = Math.max(...values);
  return weighted
    ? { label: 'Best e1RM', value: formatE1rm(best, ctx.unit) }
    : { label: 'Best reps', value: `${best} reps` };
}

export interface HistoryRow {
  id: string;
  date: string;
  summary: string;
  /** "e1RM 133 lb"; null for unweighted entries. */
  e1rm: string | null;
  deload: boolean;
  pr: boolean;
}

/** The full history of the variant, newest first. */
export function historyRows(ctx: ProgressContext, sel: Selection): HistoryRow[] {
  return [...variantHistory(ctx, sel)].reverse().map((entry) => {
    const e1rm = entryE1rm(entry, ctx.unit);
    return {
      id: entry.id,
      date: formatDate(entry.date),
      summary: formatEntrySummary(entry, ctx.unit),
      e1rm: e1rm === null ? null : `e1RM ${formatE1rm(e1rm, ctx.unit)}`,
      deload: isDeload(ctx, entry),
      pr: ctx.prEntryIds.has(entry.id),
    };
  });
}

// ---------- 7. Volume ----------

export interface Volume {
  bars: Bar[];
  /** This week's total in the display unit. */
  thisWeek: number;
}

export function volume(ctx: ProgressContext): Volume {
  const bars = recentWeekStarts(ctx.today, WEEKS).map((start) => ({
    label: weekLabel(start),
    value: weeklyVolume(ctx.entries, start, ctx.unit),
    current: start === ctx.weekStart,
  }));
  return { bars, thisWeek: bars[bars.length - 1].value };
}
