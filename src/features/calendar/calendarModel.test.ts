import { describe, expect, it } from 'vitest';
import type { CycleState, Workout } from '../../domain';
import { makeEntry, makeExercise, makeSession, REST, W } from '../../domain/test-helpers';
import {
  activeExercises,
  buildDay,
  calendarContext,
  dayTitle,
  daySheetMode,
  exerciseCount,
  groupSessionsByDate,
  plannedDetail,
  lastVisibleDate,
  monthOf,
  orderedWorkouts,
  sessionRows,
  sessionsLabel,
  shiftMonth,
  weekDates,
} from './calendarModel';

// 2026-03-04 is a Wednesday.
const TODAY = '2026-03-04';
const PPL = [W('w-push'), W('w-pull'), W('w-legs'), W('w-push'), W('w-pull'), W('w-legs'), REST];
const WORKOUTS: Workout[] = [
  { id: 'w-push', name: 'Push', exerciseIds: [] },
  { id: 'w-pull', name: 'Pull', exerciseIds: [] },
  { id: 'w-legs', name: 'Legs', exerciseIds: [] },
];

function cycle(overrides: Partial<CycleState> = {}): CycleState {
  return { items: PPL, pointer: 0, pointerSince: TODAY, restartOn: null, ...overrides };
}

function context(
  options: { cycle?: CycleState; sessions?: ReturnType<typeof makeSession>[]; until?: string } = {},
) {
  return calendarContext({
    today: TODAY,
    cycle: options.cycle ?? cycle(),
    sessions: options.sessions ?? [],
    workouts: WORKOUTS,
    until: options.until ?? '2026-03-15',
  });
}

describe('month helpers', () => {
  it('reads the month of a date', () => {
    expect(monthOf('2026-03-04')).toEqual({ year: 2026, month: 3 });
    expect(monthOf('2025-12-31')).toEqual({ year: 2025, month: 12 });
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth({ year: 2026, month: 3 }, 14)).toEqual({ year: 2027, month: 5 });
    expect(shiftMonth({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
  });

  it('gives the current week, Monday first', () => {
    expect(weekDates(TODAY)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
    // A Sunday belongs to the week that started the Monday before.
    expect(weekDates('2026-03-08')[0]).toBe('2026-03-02');
    expect(weekDates('2026-03-09')[0]).toBe('2026-03-09');
  });

  it('projects through the end of the shown grid or the current week, whichever is later', () => {
    // March 2026 ends on a Tuesday; its grid runs to Sunday April 5.
    expect(lastVisibleDate({ year: 2026, month: 3 }, TODAY)).toBe('2026-04-05');
    // A past month still projects the current week strip.
    expect(lastVisibleDate({ year: 2026, month: 1 }, TODAY)).toBe('2026-03-08');
  });

  it('titles a day without the year', () => {
    expect(dayTitle('2026-03-02')).toBe('Monday, March 2');
  });
});

describe('sessions per day', () => {
  it('groups sessions by date, oldest first', () => {
    const a = makeSession({ id: 'a', date: '2026-03-02', createdAt: 2 });
    const b = makeSession({ id: 'b', date: '2026-03-02', createdAt: 1 });
    const c = makeSession({ id: 'c', date: '2026-03-03', createdAt: 0 });
    const map = groupSessionsByDate([a, b, c]);
    expect(map.get('2026-03-02')?.map((s) => s.id)).toEqual(['b', 'a']);
    expect(map.get('2026-03-03')?.map((s) => s.id)).toEqual(['c']);
  });

  it('labels a day with its first session plus a compact count', () => {
    expect(sessionsLabel([makeSession({ workoutName: 'Push' })])).toBe('Push');
    expect(
      sessionsLabel([
        makeSession({ workoutName: 'Push' }),
        makeSession({ workoutName: 'Pull' }),
        makeSession({ workoutName: 'Legs' }),
      ]),
    ).toBe('Push +2');
  });
});

describe('day cells (6.4)', () => {
  it('a past day shows what was done, with the finished marker', () => {
    const session = makeSession({ date: '2026-03-02', workoutName: 'Push', status: 'finished' });
    const day = buildDay('2026-03-02', context({ sessions: [session] }));
    expect(day).toMatchObject({
      day: 2,
      label: 'Push',
      kind: 'session',
      completed: true,
      muted: false,
      isToday: false,
      isPast: true,
      ariaLabel: 'Monday, March 2, Push, finished',
    });
    expect(day.sessions).toEqual([session]);
  });

  it('an unfinished session has no finished marker', () => {
    const session = makeSession({ date: '2026-03-03', workoutName: 'Pull', status: 'inProgress' });
    const day = buildDay('2026-03-03', context({ sessions: [session] }));
    expect(day.completed).toBe(false);
    expect(day.ariaLabel).toBe('Tuesday, March 3, Pull, in progress');
  });

  it('several sessions on a day: first plus a count, all named for screen readers', () => {
    const sessions = [
      makeSession({ date: '2026-03-02', workoutName: 'Push', createdAt: 1 }),
      makeSession({ date: '2026-03-02', workoutName: 'Pull', createdAt: 2 }),
    ];
    const day = buildDay('2026-03-02', context({ sessions }));
    expect(day.label).toBe('Push +1');
    expect(day.ariaLabel).toBe('Monday, March 2, Push, Pull, finished');
  });

  it('a past day with no session shows no label', () => {
    const day = buildDay('2026-03-03', context());
    expect(day).toMatchObject({ kind: 'none', isPast: true, completed: false, muted: false });
    expect(day.label).toBeUndefined();
    expect(day.ariaLabel).toBe('Tuesday, March 3');
  });

  it('today without a session shows the planned workout in today style (not muted)', () => {
    const day = buildDay(TODAY, context());
    expect(day).toMatchObject({
      label: 'Push',
      kind: 'planned',
      isToday: true,
      isPast: false,
      muted: false,
      ariaLabel: 'Wednesday, March 4, today, Push, planned',
    });
  });

  it('today with a session shows the session', () => {
    const session = makeSession({ date: TODAY, workoutName: 'Push', status: 'finished' });
    // Finishing moved the pointer to Pull, arriving tomorrow.
    const ctx = context({
      sessions: [session],
      cycle: cycle({ pointer: 1, pointerSince: '2026-03-05' }),
    });
    expect(buildDay(TODAY, ctx)).toMatchObject({
      label: 'Push',
      kind: 'session',
      completed: true,
      isToday: true,
      ariaLabel: 'Wednesday, March 4, today, Push, finished',
    });
  });

  it('future days show the projection in cycle order, muted, with rest days labeled', () => {
    const ctx = context();
    const labels = ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'].map((d) =>
      buildDay(d, ctx),
    );
    expect(labels.map((d) => d.label)).toEqual(['Pull', 'Legs', 'Push', 'Pull', 'Legs']);
    expect(labels.every((d) => d.muted && d.kind === 'planned')).toBe(true);
    const rest = buildDay('2026-03-10', ctx);
    expect(rest).toMatchObject({ label: 'Rest', kind: 'rest', muted: true });
    expect(rest.ariaLabel).toBe('Tuesday, March 10, Rest');
    expect(buildDay('2026-03-11', ctx).label).toBe('Push');
  });

  it("starts the projection tomorrow when today's session is finished", () => {
    const session = makeSession({ date: TODAY, workoutName: 'Push', status: 'finished' });
    const ctx = context({
      sessions: [session],
      cycle: cycle({ pointer: 1, pointerSince: '2026-03-05' }),
    });
    const next = ['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'];
    expect(next.map((d) => buildDay(d, ctx).label)).toEqual([
      'Pull',
      'Legs',
      'Push',
      'Pull',
      'Legs',
    ]);
    expect(buildDay('2026-03-10', ctx).label).toBe('Rest');
  });

  it('days waiting for a scheduled restart read as rest; the restart begins at item 0', () => {
    const ctx = context({ cycle: cycle({ pointer: 2, restartOn: '2026-03-09' }) });
    expect(buildDay(TODAY, ctx)).toMatchObject({ label: 'Rest', kind: 'rest' });
    expect(buildDay('2026-03-08', ctx)).toMatchObject({ label: 'Rest', kind: 'rest' });
    expect(buildDay('2026-03-09', ctx).label).toBe('Push');
    expect(buildDay('2026-03-10', ctx).label).toBe('Pull');
  });

  it('an empty cycle plans nothing', () => {
    const day = buildDay('2026-03-06', context({ cycle: cycle({ items: [] }) }));
    expect(day).toMatchObject({ kind: 'none', isPast: false, muted: false });
    expect(day.label).toBeUndefined();
    expect(day.ariaLabel).toBe('Friday, March 6');
  });

  it('a projected workout that no longer exists still gets a label', () => {
    const ctx = context({ cycle: cycle({ items: [W('gone')] }) });
    expect(buildDay('2026-03-06', ctx).label).toBe('Workout');
  });

  it('picks the sheet for a day', () => {
    const session = makeSession({ date: '2026-03-02' });
    const ctx = context({ sessions: [session] });
    expect(daySheetMode(buildDay('2026-03-02', ctx))).toBe('sessions');
    expect(daySheetMode(buildDay('2026-03-03', ctx))).toBe('add');
    expect(daySheetMode(buildDay(TODAY, ctx))).toBe('planned');
    expect(daySheetMode(buildDay('2026-03-10', ctx))).toBe('planned');
  });
});

describe('planned workout list', () => {
  const chest = makeExercise({ id: 'chest', name: 'Chest press', sets: 2, repMin: 6, repMax: 12 });
  const old = makeExercise({ id: 'old', name: 'Old', archived: true });
  const abs = makeExercise({ id: 'abs', name: 'Crunch', sets: 1, repMin: 10, repMax: 15 });
  const exercises = new Map([chest, old, abs].map((e) => [e.id, e]));

  it("lists the workout's active exercises in order", () => {
    const workout: Workout = {
      id: 'w',
      name: 'Push',
      exerciseIds: ['abs', 'old', 'gone', 'chest'],
    };
    expect(activeExercises(workout, exercises).map((e) => e.name)).toEqual([
      'Crunch',
      'Chest press',
    ]);
    expect(activeExercises(undefined, exercises)).toEqual([]);
  });

  it('describes each exercise by its sets and rep range', () => {
    expect(plannedDetail(chest)).toBe('2 sets · 6–12 reps');
    expect(plannedDetail(abs)).toBe('1 set · 10–15 reps');
  });

  it('counts exercises for the picker', () => {
    expect(exerciseCount(1)).toBe('1 exercise');
    expect(exerciseCount(6)).toBe('6 exercises');
    expect(exerciseCount(0)).toBe('No exercises');
  });
});

describe('add-session picker', () => {
  it('lists workouts in cycle order, then the rest by name', () => {
    const workouts: Workout[] = [
      { id: 'w-z', name: 'Zone 2', exerciseIds: [] },
      { id: 'w-legs', name: 'Legs', exerciseIds: [] },
      { id: 'w-arms', name: 'Arms', exerciseIds: [] },
      { id: 'w-pull', name: 'Pull', exerciseIds: [] },
      { id: 'w-push', name: 'Push', exerciseIds: [] },
    ];
    expect(orderedWorkouts(workouts, PPL).map((w) => w.name)).toEqual([
      'Push',
      'Pull',
      'Legs',
      'Arms',
      'Zone 2',
    ]);
  });
});

describe("a session's rows", () => {
  const chest = makeExercise({ id: 'chest', name: 'Chest press' });
  const fly = makeExercise({ id: 'fly', name: 'Chest fly' });
  const raise = makeExercise({ id: 'raise', name: 'Lateral raise' });
  const old = makeExercise({ id: 'old', name: 'Old', archived: true });
  const curl = makeExercise({ id: 'curl', name: 'Curl' });
  const exercises = new Map([chest, fly, raise, old, curl].map((e) => [e.id, e]));
  const workout: Workout = {
    id: 'w-push',
    name: 'Push',
    exerciseIds: ['chest', 'fly', 'old', 'raise'],
  };

  it('follows workout order, shows open slots, and appends entries outside the workout', () => {
    const raiseEntry = makeEntry({ id: 'e-raise', exerciseId: 'raise', createdAt: 1 });
    const chestEntry = makeEntry({ id: 'e-chest', exerciseId: 'chest', createdAt: 2 });
    const curlEntry = makeEntry({ id: 'e-curl', exerciseId: 'curl', createdAt: 3 });
    const rows = sessionRows(workout, [curlEntry, raiseEntry, chestEntry], exercises);
    expect(rows).toEqual([
      { kind: 'entry', entry: chestEntry },
      { kind: 'missing', exerciseId: 'fly' },
      { kind: 'entry', entry: raiseEntry },
      { kind: 'entry', entry: curlEntry },
    ]);
  });

  it('a swapped entry stands in its slot; an archived slot with an entry still shows', () => {
    const swapped = makeEntry({
      id: 'e-swap',
      exerciseId: 'curl',
      swappedFromExerciseId: 'fly',
    });
    const archived = makeEntry({ id: 'e-old', exerciseId: 'old' });
    const rows = sessionRows(workout, [swapped, archived], exercises);
    expect(rows).toEqual([
      { kind: 'missing', exerciseId: 'chest' },
      { kind: 'entry', entry: swapped },
      { kind: 'entry', entry: archived },
      { kind: 'missing', exerciseId: 'raise' },
    ]);
  });

  it('a deleted workout lists only the entries, oldest first', () => {
    const a = makeEntry({ id: 'a', exerciseId: 'raise', createdAt: 2 });
    const b = makeEntry({ id: 'b', exerciseId: 'chest', createdAt: 1 });
    expect(sessionRows(undefined, [a, b], exercises)).toEqual([
      { kind: 'entry', entry: b },
      { kind: 'entry', entry: a },
    ]);
  });
});
