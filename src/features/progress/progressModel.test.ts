import { describe, expect, it } from 'vitest';
import type { Exercise, LogEntry, Session } from '../../domain';
import { makeEntry, makeExercise, makeSession } from '../../domain/test-helpers';
import {
  buildContext,
  chartDateLabel,
  consistency,
  detailBest,
  detailChart,
  exerciseOptions,
  hasAnyData,
  historyRows,
  muscleSets,
  recentPrs,
  resolveSelection,
  stalledRows,
  thisWeek,
  variantOptions,
  volume,
  type ProgressData,
} from './progressModel';

// 2026-03-04 is a Wednesday; its week starts Monday 2026-03-02.
const TODAY = '2026-03-04';

const chest = makeExercise({
  id: 'chest',
  name: 'Chest press',
  muscleGroup: 'chest',
  repMin: 6,
  variants: [
    { id: 'machine', name: 'Machine', note: '', archived: false },
    { id: 'bench', name: 'Bench', note: '', archived: false },
  ],
  defaultVariantId: 'machine',
});
const curl = makeExercise({
  id: 'curl',
  name: 'Curl',
  muscleGroup: 'biceps',
  repMin: 10,
  variants: [{ id: 'preacher', name: 'Preacher curl', note: '', archived: false }],
  defaultVariantId: 'preacher',
});
const crunch = makeExercise({
  id: 'crunch',
  name: 'Incline bench crunch',
  muscleGroup: 'abs',
  repMin: 10,
  variants: [{ id: 'incline', name: 'Incline bench', note: '', archived: false }],
  defaultVariantId: 'incline',
});

let clock = 0;

/** A finished session on `date` with one logged entry per item. */
function session(
  date: string,
  items: Array<Partial<LogEntry> & { reps?: Array<number | null> }>,
  overrides: Partial<Session> = {},
): { session: Session; entries: LogEntry[] } {
  clock += 1;
  const s = makeSession({ id: `s-${date}-${clock}`, date, createdAt: clock, ...overrides });
  const entries = items.map((item, i) =>
    makeEntry({
      id: `e-${date}-${clock}-${i}`,
      sessionId: s.id,
      date,
      createdAt: clock * 100 + i,
      exerciseId: 'chest',
      variantId: 'machine',
      ...item,
    }),
  );
  return { session: s, entries };
}

function data(
  parts: Array<{ session: Session; entries: LogEntry[] }>,
  overrides: Partial<ProgressData> = {},
): ProgressData {
  return {
    sessions: parts.map((p) => p.session),
    entries: parts.flatMap((p) => p.entries),
    exercises: [chest, curl, crunch],
    unit: 'lb',
    today: TODAY,
    ...overrides,
  };
}

describe('empty data', () => {
  it('has no data and no rows anywhere', () => {
    const ctx = buildContext(data([]));
    expect(hasAnyData(ctx)).toBe(false);
    expect(thisWeek(ctx)).toEqual({ sessions: 0, prs: 0, hardSets: 0 });
    expect(muscleSets(ctx).rows).toEqual([]);
    expect(recentPrs(ctx)).toEqual([]);
    expect(stalledRows(ctx)).toEqual([]);
    expect(exerciseOptions(ctx)).toEqual([]);
    expect(resolveSelection(ctx, {})).toBeNull();
  });

  it('a finished session alone counts as data', () => {
    const ctx = buildContext(data([session('2026-03-02', [])]));
    expect(hasAnyData(ctx)).toBe(true);
  });
});

describe('this week', () => {
  it('counts finished sessions, PR events, and hard sets in the Monday-based week', () => {
    const ctx = buildContext(
      data([
        // Last week: the baseline (no PR on a first entry).
        session('2026-02-25', [{ weight: 100, reps: [8, 8] }]),
        // This week: weight PR + e1RM PR (rep PR needs earlier sets at 110+).
        session('2026-03-02', [{ weight: 110, reps: [8, 7] }]),
        // Deload this week: its 3 sets count as hard sets, it sets no PR.
        session('2026-03-03', [{ weight: 150, reps: [8, 8, 8] }], { deload: true }),
        // In progress: not a finished session; its draft entry is no hard set.
        session('2026-03-04', [{ weight: 120, reps: [8, 8], status: 'draft' }], {
          status: 'inProgress',
        }),
      ]),
    );
    expect(thisWeek(ctx)).toEqual({ sessions: 2, prs: 2, hardSets: 5 });
  });
});

describe('consistency', () => {
  it('8 weekly bars, the current week flagged, with the streak', () => {
    const ctx = buildContext(
      data([
        session('2026-02-16', []),
        session('2026-02-23', []),
        session('2026-02-24', []),
        session('2026-03-02', []),
        session('2026-01-05', [], { status: 'inProgress' }),
      ]),
    );
    const { bars, streak } = consistency(ctx);
    expect(bars).toHaveLength(8);
    expect(bars.map((b) => b.label)).toEqual([
      '1/12',
      '1/19',
      '1/26',
      '2/2',
      '2/9',
      '2/16',
      '2/23',
      '3/2',
    ]);
    expect(bars.map((b) => b.value)).toEqual([0, 0, 0, 0, 0, 1, 2, 1]);
    expect(bars.map((b) => Boolean(b.current))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(streak).toBe(3);
  });
});

describe('sets per muscle group', () => {
  it('this week against last week, only groups with sets in either week, in muscle order', () => {
    const ctx = buildContext(
      data([
        session('2026-02-24', [
          { exerciseId: 'curl', variantId: 'preacher', weight: 30, reps: [12, 10] },
          { weight: 100, reps: [8, 0] },
        ]),
        session('2026-03-03', [{ weight: 100, reps: [8, 8] }], { deload: true }),
        session('2026-03-04', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [15, 12, 10] },
        ]),
        // Two weeks ago: outside both weeks.
        session('2026-02-17', [{ exerciseId: 'curl', variantId: 'preacher', reps: [9, 9] }]),
      ]),
    );
    const { rows, current, previous } = muscleSets(ctx);
    expect(rows).toEqual([
      { label: 'Chest', current: 2, previous: 1 },
      { label: 'Biceps', current: 0, previous: 2 },
      { label: 'Abs', current: 3, previous: 0 },
    ]);
    expect(current).toBe(5);
    expect(previous).toBe(3);
  });
});

describe('recent PRs', () => {
  it('newest first, with exercise, variant, kind, value in the display unit, and date', () => {
    const ctx = buildContext(
      data([
        session('2026-02-10', [{ weight: 100, reps: [8, 8] }]),
        session('2026-02-17', [{ weight: 100, reps: [10, 8] }]),
        session('2026-02-24', [{ weight: 110, reps: [8, 8] }]),
        session('2026-03-02', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [15] },
        ]),
        session('2026-03-03', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [18] },
        ]),
      ]),
    );
    const rows = recentPrs(ctx);
    expect(rows.map((r) => [r.exercise, r.variant, r.kind, r.value, r.date])).toEqual([
      ['Incline bench crunch', 'Incline bench', 'Rep PR', 'BW × 18', 'Tue, Mar 3'],
      ['Chest press', 'Machine', 'Weight PR', '110 lb', 'Tue, Feb 24'],
      ['Chest press', 'Machine', 'e1RM PR', '139 lb', 'Tue, Feb 24'],
      ['Chest press', 'Machine', 'Rep PR', '100 lb × 10', 'Tue, Feb 17'],
      ['Chest press', 'Machine', 'e1RM PR', '133 lb', 'Tue, Feb 17'],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('keeps the latest 10 and orders same-day entries by when they were logged', () => {
    const parts = Array.from({ length: 12 }, (_, i) =>
      session(`2026-02-${String(10 + i).padStart(2, '0')}`, [{ weight: 100 + i, reps: [8, 8] }]),
    );
    const ctx = buildContext(data(parts));
    const rows = recentPrs(ctx);
    expect(rows).toHaveLength(10);
    expect(rows[0].date).toBe('Sat, Feb 21');
    expect(rows[0].value).toBe('111 lb');
  });

  it('converts kg entries to the display unit and keeps archived names', () => {
    const archived: Exercise = {
      ...chest,
      archived: true,
      variants: chest.variants.map((v) => ({ ...v, archived: true })),
    };
    const ctx = buildContext(
      data(
        [
          session('2026-02-24', [{ unit: 'kg', weight: 50, reps: [8, 8] }]),
          session('2026-03-02', [{ unit: 'kg', weight: 60, reps: [8, 8] }]),
        ],
        { exercises: [archived, curl, crunch] },
      ),
    );
    const weight = recentPrs(ctx).find((r) => r.kind === 'Weight PR')!;
    expect(weight).toMatchObject({
      exercise: 'Chest press',
      variant: 'Machine',
      value: '132.5 lb',
    });
  });

  it('deload sessions never set a PR', () => {
    const ctx = buildContext(
      data([
        session('2026-02-24', [{ weight: 100, reps: [8, 8] }]),
        session('2026-03-02', [{ weight: 200, reps: [8, 8] }], { deload: true }),
      ]),
    );
    expect(recentPrs(ctx)).toEqual([]);
  });
});

describe('stalled', () => {
  const flat = (date: string, variantId = 'machine') =>
    session(date, [{ variantId, weight: 100, reps: [8, 8] }]);

  it('lists stalled pairs and leaves out archived exercises and variants', () => {
    const parts = [
      ...['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'].map((d) => flat(d)),
      ...['2026-02-03', '2026-02-10', '2026-02-17', '2026-02-24'].map((d) => flat(d, 'bench')),
    ];
    const ctx = buildContext(data(parts));
    expect(stalledRows(ctx).map((r) => [r.exercise, r.variant])).toEqual([
      ['Chest press', 'Bench'],
      ['Chest press', 'Machine'],
    ]);

    const benchArchived: Exercise = {
      ...chest,
      variants: chest.variants.map((v) => (v.id === 'bench' ? { ...v, archived: true } : v)),
    };
    const ctx2 = buildContext(data(parts, { exercises: [benchArchived, curl, crunch] }));
    expect(stalledRows(ctx2).map((r) => r.variant)).toEqual(['Machine']);

    const ctx3 = buildContext(
      data(parts, { exercises: [{ ...chest, archived: true }, curl, crunch] }),
    );
    expect(stalledRows(ctx3)).toEqual([]);
  });
});

describe('exercise detail', () => {
  const history = () => [
    session('2026-01-05', [{ weight: 100, reps: [8, 8] }]),
    session('2026-02-09', [{ weight: 105, reps: [8, 8] }]),
    session('2026-02-16', [{ weight: 80, reps: [8, 8] }], { deload: true }),
    session('2026-02-23', [{ weight: 105, reps: [8, 7] }]),
    session('2026-03-02', [{ variantId: 'bench', weight: 135, reps: [6, 6] }]),
    session('2026-03-03', [
      { exerciseId: 'curl', variantId: 'preacher', weight: 30, reps: [12, 12], status: 'draft' },
    ]),
  ];

  it('offers exercises with logged history (archived ones labelled) and their variants', () => {
    const archivedCrunch: Exercise = { ...crunch, archived: true };
    const ctx = buildContext(
      data(
        [
          ...history(),
          session('2026-01-06', [{ exerciseId: 'crunch', variantId: 'incline', reps: [15] }]),
        ],
        { exercises: [chest, curl, archivedCrunch] },
      ),
    );
    expect(exerciseOptions(ctx)).toEqual([
      { value: 'chest', label: 'Chest press' },
      { value: 'crunch', label: 'Incline bench crunch (archived)' },
    ]);
    expect(variantOptions(ctx, 'chest')).toEqual([
      { value: 'machine', label: 'Machine' },
      { value: 'bench', label: 'Bench' },
    ]);
    expect(variantOptions(ctx, 'curl')).toEqual([]);
  });

  it('ignores entries whose variant is unknown to the exercise', () => {
    const ctx = buildContext(
      data([
        session('2026-03-02', [{ variantId: 'machine', weight: 100, reps: [8, 8] }]),
        session('2026-03-03', [{ exerciseId: 'curl', variantId: 'unknown', reps: [12] }]),
      ]),
    );
    expect(exerciseOptions(ctx).map((o) => o.value)).toEqual(['chest']);
    expect(resolveSelection(ctx, {})).toEqual({ exerciseId: 'chest', variantId: 'machine' });
  });

  it('selection defaults to the latest logged entry and keeps a valid choice', () => {
    const ctx = buildContext(data(history()));
    expect(resolveSelection(ctx, {})).toEqual({ exerciseId: 'chest', variantId: 'bench' });
    expect(resolveSelection(ctx, { exerciseId: 'chest', variantId: 'machine' })).toEqual({
      exerciseId: 'chest',
      variantId: 'machine',
    });
    // An exercise without history, or a stale variant, falls back.
    expect(resolveSelection(ctx, { exerciseId: 'curl' })).toEqual({
      exerciseId: 'chest',
      variantId: 'bench',
    });
    expect(resolveSelection(ctx, { exerciseId: 'chest', variantId: 'gone' })).toEqual({
      exerciseId: 'chest',
      variantId: 'bench',
    });
  });

  it('charts e1RM and top weight with PR points highlighted and deloads muted', () => {
    const ctx = buildContext(data(history()));
    const chart = detailChart(ctx, { exerciseId: 'chest', variantId: 'machine' }, 'all');
    expect(chart.metric).toBe('e1rm');
    expect(chart.series.map((s) => [s.id, s.tone])).toEqual([
      ['e1rm', 'primary'],
      ['top', 'secondary'],
    ]);
    const [e1rm, top] = chart.series;
    expect(e1rm.points.map((p) => Math.round(p.y))).toEqual([127, 133, 101, 133]);
    expect(top.points.map((p) => p.y)).toEqual([100, 105, 80, 105]);
    expect(e1rm.points.map((p) => Boolean(p.highlight))).toEqual([false, true, false, false]);
    expect(e1rm.points.map((p) => Boolean(p.muted))).toEqual([false, false, true, false]);
    expect(top.points.map((p) => Boolean(p.muted))).toEqual([false, false, true, false]);
    expect(top.points.some((p) => p.highlight)).toBe(false);
    expect(chartDateLabel(e1rm.points[0].x)).toBe('Jan 5');
    expect(e1rm.points[1].label).toBe('Feb 9 · 133 lb · PR');
    expect(e1rm.points[2].label).toBe('Feb 16 · 101 lb · Deload');
  });

  it('the range switch limits the points to the last 1 or 3 months', () => {
    const ctx = buildContext(data(history()));
    const sel = { exerciseId: 'chest', variantId: 'machine' };
    const count = (range: '1m' | '3m' | 'all') =>
      detailChart(ctx, sel, range).series[0].points.length;
    expect(count('all')).toBe(4);
    expect(count('3m')).toBe(4);
    expect(count('1m')).toBe(3);
    const ctxLater = buildContext(data(history(), { today: '2026-04-20' }));
    expect(detailChart(ctxLater, sel, '1m').series[0].points).toHaveLength(0);
    expect(detailChart(ctxLater, sel, '3m').series[0].points).toHaveLength(3);
  });

  it('charts best reps for unweighted variants', () => {
    const ctx = buildContext(
      data([
        session('2026-02-23', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [15, 12] },
        ]),
        session('2026-03-02', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [18, 12] },
        ]),
      ]),
    );
    const chart = detailChart(ctx, { exerciseId: 'crunch', variantId: 'incline' }, 'all');
    expect(chart.metric).toBe('reps');
    expect(chart.series).toHaveLength(1);
    expect(chart.series[0]).toMatchObject({ id: 'reps', tone: 'primary' });
    expect(chart.series[0].points.map((p) => [p.y, Boolean(p.highlight)])).toEqual([
      [15, false],
      [18, true],
    ]);
    expect(chart.series[0].points[1].label).toBe('Mar 2 · 18 reps · PR');
    expect(detailBest(ctx, { exerciseId: 'crunch', variantId: 'incline' })).toEqual({
      label: 'Best reps',
      value: '18 reps',
    });
  });

  it('best e1RM ignores deload sessions', () => {
    const ctx = buildContext(
      data([
        session('2026-02-23', [{ weight: 100, reps: [8, 8] }]),
        session('2026-03-02', [{ weight: 200, reps: [8, 8] }], { deload: true }),
      ]),
    );
    expect(detailBest(ctx, { exerciseId: 'chest', variantId: 'machine' })).toEqual({
      label: 'Best e1RM',
      value: '127 lb',
    });
  });

  it('history: every logged entry, newest first, with summary, e1RM, and badges', () => {
    const ctx = buildContext(data(history()));
    const rows = historyRows(ctx, { exerciseId: 'chest', variantId: 'machine' });
    expect(rows.map((r) => [r.date, r.summary, r.e1rm, r.deload, r.pr])).toEqual([
      ['Mon, Feb 23', '105 lb × 8, 7', 'e1RM 133 lb', false, false],
      ['Mon, Feb 16', '80 lb × 8, 8', 'e1RM 101 lb', true, false],
      ['Mon, Feb 9', '105 lb × 8, 8', 'e1RM 133 lb', false, true],
      ['Mon, Jan 5', '100 lb × 8, 8', 'e1RM 127 lb', false, false],
    ]);
  });

  it('history of an unweighted entry has no e1RM', () => {
    const ctx = buildContext(
      data([
        session('2026-03-02', [
          { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [15] },
        ]),
      ]),
    );
    const [row] = historyRows(ctx, { exerciseId: 'crunch', variantId: 'incline' });
    expect(row).toMatchObject({ summary: 'BW × 15', e1rm: null });
  });
});

describe('volume', () => {
  it('weekly volume for the last 8 weeks in the display unit, deloads included', () => {
    const ctx = buildContext(
      data(
        [
          session('2026-02-23', [{ weight: 100, reps: [10, 10] }]),
          session('2026-03-02', [{ unit: 'kg', weight: 50, reps: [10] }], { deload: true }),
          session('2026-03-03', [
            { exerciseId: 'crunch', variantId: 'incline', weight: null, reps: [20] },
          ]),
        ],
        { unit: 'lb' },
      ),
    );
    const { bars, thisWeek: current } = volume(ctx);
    expect(bars).toHaveLength(8);
    expect(bars.at(-1)).toMatchObject({ label: '3/2', current: true });
    expect(bars.at(-2)).toMatchObject({ label: '2/23', value: 2000 });
    expect(Math.round(current)).toBe(1102);
    expect(bars.slice(0, 6).every((b) => b.value === 0 && !b.current)).toBe(true);
  });
});
