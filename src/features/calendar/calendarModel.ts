// View model for the Calendar (SPEC 5.2, 6.4): what each day cell shows and
// which sheet it opens. The projection itself comes from src/domain and is
// never stored.
import {
  addDays,
  entryForSlot,
  maxDate,
  monthMatrix,
  parseISODate,
  projectCycle,
  sortChronologically,
  weekStart,
  type CycleItem,
  type CycleState,
  type Exercise,
  type ISODate,
  type LogEntry,
  type ProjectedDay,
  type Session,
  type Workout,
} from '../../domain';

/** `month` is 1–12. */
export interface YearMonth {
  year: number;
  month: number;
}

export function monthOf(date: ISODate): YearMonth {
  const d = parseISODate(date);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** The seven days of the week containing `today`, Monday first. */
export function weekDates(today: ISODate): ISODate[] {
  const start = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The last day the screen shows: the end of the month grid or of the current week. */
export function lastVisibleDate(shown: YearMonth, today: ISODate): ISODate {
  const weeks = monthMatrix(shown.year, shown.month);
  const gridEnd = weeks[weeks.length - 1][6];
  return maxDate(gridEnd, addDays(weekStart(today), 6));
}

const DAY_TITLE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "Monday, March 2". */
export function dayTitle(date: ISODate): string {
  return DAY_TITLE.format(parseISODate(date));
}

/** Sessions by date, oldest first within a day. */
export function groupSessionsByDate(sessions: Session[]): Map<ISODate, Session[]> {
  const map = new Map<ISODate, Session[]>();
  for (const session of [...sessions].sort((a, b) => a.createdAt - b.createdAt)) {
    const list = map.get(session.date);
    if (list) list.push(session);
    else map.set(session.date, [session]);
  }
  return map;
}

/** "Push", or "Push +1" when the day has more sessions. */
export function sessionsLabel(sessions: Session[]): string {
  const [first, ...more] = sessions;
  return more.length > 0 ? `${first.workoutName} +${more.length}` : first.workoutName;
}

export interface CalendarContext {
  today: ISODate;
  sessionsByDate: Map<ISODate, Session[]>;
  projection: Map<ISODate, ProjectedDay>;
  workoutNames: Map<string, string>;
}

/** Everything a day cell needs: sessions by date and the projection through `until`. */
export function calendarContext(input: {
  today: ISODate;
  cycle: CycleState;
  sessions: Session[];
  workouts: Workout[];
  until: ISODate;
}): CalendarContext {
  return {
    today: input.today,
    sessionsByDate: groupSessionsByDate(input.sessions),
    projection: new Map(
      projectCycle(input.cycle, input.today, input.until).map((day) => [day.date, day]),
    ),
    workoutNames: new Map(input.workouts.map((w) => [w.id, w.name])),
  };
}

/**
 * `session`: something was done that day. `planned` / `rest`: the projection.
 * `none`: a past day with no session, or nothing planned.
 */
export type DayKind = 'session' | 'planned' | 'rest' | 'none';

export interface CalendarDayModel {
  date: ISODate;
  day: number;
  label?: string;
  kind: DayKind;
  isToday: boolean;
  /** Strictly before today. */
  isPast: boolean;
  /** At least one finished session (the green dot). */
  completed: boolean;
  /** Projected and rest days use tertiary ink (today keeps its own style). */
  muted: boolean;
  ariaLabel: string;
  /** That day's sessions, oldest first. */
  sessions: Session[];
  /** The projected item when the day shows the projection. */
  planned: ProjectedDay | null;
}

export function plannedName(item: CycleItem, workoutNames: Map<string, string>): string {
  return item.kind === 'rest' ? 'Rest' : (workoutNames.get(item.workoutId) ?? 'Workout');
}

export function buildDay(date: ISODate, ctx: CalendarContext): CalendarDayModel {
  const isToday = date === ctx.today;
  const isPast = date < ctx.today;
  const sessions = ctx.sessionsByDate.get(date) ?? [];
  const base = {
    date,
    day: parseISODate(date).getDate(),
    isToday,
    isPast,
    sessions,
    planned: null,
    completed: false,
    muted: false,
  };
  const title = isToday ? `${dayTitle(date)}, today` : dayTitle(date);

  if (sessions.length > 0) {
    const finished = sessions.every((s) => s.status === 'finished');
    return {
      ...base,
      kind: 'session',
      label: sessionsLabel(sessions),
      completed: sessions.some((s) => s.status === 'finished'),
      ariaLabel: [
        title,
        ...sessions.map((s) => s.workoutName),
        finished ? 'finished' : 'in progress',
      ].join(', '),
    };
  }

  const planned = isPast ? undefined : ctx.projection.get(date);
  if (!planned) return { ...base, kind: 'none', ariaLabel: title };

  const label = plannedName(planned.item, ctx.workoutNames);
  const rest = planned.item.kind === 'rest';
  return {
    ...base,
    kind: rest ? 'rest' : 'planned',
    label,
    planned,
    muted: !isToday,
    ariaLabel: rest ? `${title}, ${label}` : `${title}, ${label}, planned`,
  };
}

/** Which sheet a tap opens: the day's sessions, adding a past session, or the plan (read-only). */
export type DaySheetMode = 'sessions' | 'add' | 'planned';

export function daySheetMode(day: CalendarDayModel): DaySheetMode {
  if (day.sessions.length > 0) return 'sessions';
  return day.isPast ? 'add' : 'planned';
}

/** Workouts for the add-session picker: cycle order first, then the others by name. */
export function orderedWorkouts(workouts: Workout[], items: CycleItem[]): Workout[] {
  const order: string[] = [];
  for (const item of items) {
    if (item.kind === 'workout' && !order.includes(item.workoutId)) order.push(item.workoutId);
  }
  const rank = (w: Workout) => {
    const i = order.indexOf(w.id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return [...workouts].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** A workout's exercises that still exist and are active, in workout order. */
export function activeExercises(
  workout: Workout | undefined,
  exercisesById: Pick<Map<string, Exercise>, 'get'>,
): Exercise[] {
  const list: Exercise[] = [];
  for (const id of workout?.exerciseIds ?? []) {
    const exercise = exercisesById.get(id);
    if (exercise && !exercise.archived) list.push(exercise);
  }
  return list;
}

/** "2 sets · 6–12 reps" for the read-only planned list. */
export function plannedDetail(exercise: Exercise): string {
  const sets = exercise.sets === 1 ? '1 set' : `${exercise.sets} sets`;
  return `${sets} · ${exercise.repMin}–${exercise.repMax} reps`;
}

export function exerciseCount(count: number): string {
  if (count === 0) return 'No exercises';
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

export type SessionRow =
  | { kind: 'entry'; entry: LogEntry }
  /** A workout exercise with no entry yet; it can be logged after the fact. */
  | { kind: 'missing'; exerciseId: string };

/**
 * A session's rows in the day sheet: the workout's exercises in order (each
 * filled by its entry, or open when it has none and is still active), then
 * any entries outside the workout, oldest first.
 */
export function sessionRows(
  workout: Workout | undefined,
  entries: LogEntry[],
  exercisesById: Pick<Map<string, Exercise>, 'get'>,
): SessionRow[] {
  const rows: SessionRow[] = [];
  const used = new Set<string>();
  for (const slot of workout?.exerciseIds ?? []) {
    const entry = entryForSlot(entries, slot);
    if (entry && !used.has(entry.id)) {
      used.add(entry.id);
      rows.push({ kind: 'entry', entry });
      continue;
    }
    const exercise = exercisesById.get(slot);
    if (exercise && !exercise.archived) rows.push({ kind: 'missing', exerciseId: slot });
  }
  for (const entry of sortChronologically(entries)) {
    if (!used.has(entry.id)) rows.push({ kind: 'entry', entry });
  }
  return rows;
}
