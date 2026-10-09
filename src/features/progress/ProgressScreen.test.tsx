import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLoggedEntry,
  completeFirstRun,
  createPastSession,
  readAllData,
  removeExercise,
  setSessionDeload,
  updateSettings,
  wipeAllData,
} from '../../data';
import { addDays, todayISO, weekStart, type SetLog } from '../../domain';
import { ProgressScreen } from './ProgressScreen';

const TODAY = todayISO();
// Anchor on this week's Monday so "this week" never depends on the weekday.
const MONDAY = weekStart(TODAY);
const week = (n: number) => addDays(MONDAY, 7 * n);

const reps = (...values: number[]): SetLog[] => values.map((r) => ({ reps: r, weight: null }));

function renderProgress() {
  return render(
    <MemoryRouter>
      <ProgressScreen />
    </MemoryRouter>,
  );
}

const region = (name: string) => screen.getByRole('region', { name });
const findRegion = (name: string) => screen.findByRole('region', { name });

async function seed(
  date: string,
  items: Array<{ exercise: string; variant: string; weight: number | null; sets: SetLog[] }>,
  options: { deload?: boolean; workout?: string } = {},
) {
  const data = await readAllData(TODAY);
  const workout = data.workouts.find((w) => w.name === (options.workout ?? 'Push'))!;
  const session = await createPastSession(date, workout.id);
  if (options.deload) await setSessionDeload(session.id, true);
  for (const item of items) {
    // Entries order by creation time within a date; keep it unambiguous.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const exercise = data.exercises.find((e) => e.name === item.exercise)!;
    await addLoggedEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      variantId: exercise.variants.find((v) => v.name === item.variant)!.id,
      unit: 'lb',
      weight: item.weight,
      sets: item.sets,
    });
  }
}

/** Five weeks of history: a stalled Machine, a Bench PR this week, a deload, curls. */
async function seedHistory() {
  for (const n of [-4, -3, -2]) {
    await seed(week(n), [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(8, 8) },
    ]);
  }
  await seed(week(-1), [
    { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(8, 8) },
    { exercise: 'Chest press', variant: 'Bench', weight: 135, sets: reps(6, 6) },
  ]);
  await seed(
    addDays(week(-1), 2),
    [{ exercise: 'Chest press', variant: 'Machine', weight: 80, sets: reps(8, 8) }],
    { deload: true },
  );
  await seed(
    week(-1),
    [{ exercise: 'Curl', variant: 'Preacher curl', weight: 30, sets: reps(12, 10) }],
    { workout: 'Pull' },
  );
  await seed(week(0), [
    { exercise: 'Chest press', variant: 'Bench', weight: 140, sets: reps(6, 6) },
    { exercise: 'Incline bench crunch', variant: 'Incline bench', weight: null, sets: reps(15) },
  ]);
}

beforeEach(async () => {
  await wipeAllData();
  await completeFirstRun('template', 'lb', TODAY);
});

describe('Progress screen', () => {
  it('a fresh install explains every card instead of showing numbers', async () => {
    renderProgress();
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    await findRegion('This week');
    expect(within(region('This week')).getByText('Nothing logged yet')).toBeInTheDocument();
    expect(within(region('Consistency')).getByText('No finished sessions yet')).toBeInTheDocument();
    expect(
      within(region('Sets per muscle group')).getByText('No sets this week or last week'),
    ).toBeInTheDocument();
    expect(within(region('Recent PRs')).getByText('No PRs yet')).toBeInTheDocument();
    expect(
      within(region('Exercise detail')).getByText('No exercise history yet'),
    ).toBeInTheDocument();
    expect(within(region('Volume')).getByText('No volume yet')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Stalled' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Sections top to bottom.
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'This week',
      'Consistency',
      'Sets per muscle group',
      'Recent PRs',
      'Exercise detail',
      'Volume',
    ]);
  });

  it('shows every section from logged history', async () => {
    await seedHistory();
    renderProgress();
    await findRegion('Stalled');

    // 1. This week: one session, weight + e1RM PRs on Bench, 3 hard sets.
    const thisWeek = within(region('This week'));
    expect(thisWeek.getByText('Session').previousSibling).toHaveTextContent('1');
    expect(thisWeek.getByText('PRs set').previousSibling).toHaveTextContent('2');
    expect(thisWeek.getByText('Hard sets').previousSibling).toHaveTextContent('3');

    // 2. Consistency: 5 weeks in a row, 8 bars with this week highlighted.
    const consistency = within(region('Consistency'));
    expect(consistency.getByText('5 weeks')).toBeInTheDocument();
    const sessionsChart = consistency.getByRole('img');
    expect(sessionsChart).toHaveAccessibleName(/this week 1$/);
    expect(sessionsChart).toHaveAccessibleName(/week of .* 3, this week/);
    expect(sessionsChart.querySelectorAll('[data-current]')).toHaveLength(1);

    // 3. Sets per muscle group: this week against last week.
    const sets = within(region('Sets per muscle group'));
    expect(sets.getByText('3 sets')).toBeInTheDocument();
    expect(sets.getByText('This week, 8 last week')).toBeInTheDocument();
    expect(sets.getByRole('img')).toHaveAccessibleName(
      'Hard sets per muscle group, this week against last week: Chest 2 against 6, Biceps 0 against 2, Abs 1 against 0',
    );

    // 4. Recent PRs: newest first, with variant, kind, value, and date.
    const prs = within(region('Recent PRs')).getAllByRole('listitem');
    expect(prs).toHaveLength(2);
    expect(prs[0]).toHaveTextContent('Chest press');
    expect(prs[0]).toHaveTextContent('Bench · Weight PR');
    expect(prs[0]).toHaveTextContent(/140 lb\w{3}, \w{3} \d+$/);
    expect(prs[1]).toHaveTextContent('Bench · e1RM PR');
    expect(prs[1]).toHaveTextContent('168 lb');

    // 5. Stalled: Machine (4 non-deload entries, no progress).
    const stalled = within(region('Stalled')).getAllByRole('listitem');
    expect(stalled).toHaveLength(1);
    expect(stalled[0]).toHaveTextContent('Chest press');
    expect(stalled[0]).toHaveTextContent('Machine');

    // 6. Exercise detail: defaults to the latest logged entry.
    const detail = within(region('Exercise detail'));
    expect(detail.getByLabelText('Exercise')).toHaveValue(
      (await readAllData(TODAY)).exercises.find((e) => e.name === 'Incline bench crunch')!.id,
    );
    expect(detail.getByText('Best reps', { selector: 'p' })).toBeInTheDocument();
    expect(detail.getByText('15 reps')).toBeInTheDocument();

    // 7. Volume: this week's weight × reps.
    const volume = within(region('Volume'));
    expect(volume.getByText('1,680 lb')).toBeInTheDocument();
    expect(volume.getByRole('img').querySelectorAll('[data-current]')).toHaveLength(1);
  });

  it('exercise detail: variants, PR and deload points, range switch, and history', async () => {
    const user = userEvent.setup();
    await seedHistory();
    // An old Machine entry outside the 3-month range.
    await seed(addDays(MONDAY, -120), [
      { exercise: 'Chest press', variant: 'Machine', weight: 90, sets: reps(8, 8) },
    ]);
    renderProgress();
    await findRegion('Stalled');
    const detail = within(region('Exercise detail'));

    await user.selectOptions(detail.getByLabelText('Exercise'), 'Chest press');
    // Two variants with history: chips; the latest one (Bench) is selected.
    const variant = detail.getByRole('radiogroup', { name: 'Variant' });
    expect(within(variant).getByRole('radio', { name: 'Bench' })).toBeChecked();
    expect(detail.getByText('Best e1RM')).toBeInTheDocument();
    expect(detail.getByText('168 lb')).toBeInTheDocument();

    await user.click(within(variant).getByRole('radio', { name: 'Machine' }));
    const chart = () => detail.getByRole('img', { name: /^e1RM and Top weight over time/ });
    // 3M (default): 4 normal + 1 deload entries; the deload point is muted on both lines.
    expect(chart()).toHaveAccessibleName(/Chest press, Machine: 5 sessions$/);
    expect(chart().querySelectorAll('[data-series="e1rm"] circle')).toHaveLength(5);
    expect(chart().querySelectorAll('circle[data-muted]')).toHaveLength(2);
    // 100 lb four weeks ago beat the old 90 lb entry: one PR point.
    expect(chart().querySelectorAll('circle[data-pr]')).toHaveLength(1);

    // All: the old entry joins the chart.
    await user.click(detail.getByRole('radio', { name: 'All' }));
    expect(chart()).toHaveAccessibleName(/Chest press, Machine: 6 sessions$/);
    expect(chart().querySelectorAll('[data-series="e1rm"] circle')).toHaveLength(6);
    expect(chart().querySelectorAll('circle[data-pr]')).toHaveLength(1);

    // Full history, newest first, with badges.
    const history = within(detail.getByRole('list', { name: /^History for Chest press, Machine/ }));
    const rows = history.getAllByRole('listitem');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('80 lb × 8, 8 · e1RM 101 lb');
    expect(within(rows[0]).getByText('Deload')).toBeInTheDocument();
    expect(rows[5]).toHaveTextContent('90 lb × 8, 8');
    expect(within(rows[4]).getByText('PR')).toBeInTheDocument();
  });

  it('archived exercises keep their names in PRs and detail; stalled leaves them out', async () => {
    const user = userEvent.setup();
    await seedHistory();
    const chest = (await readAllData(TODAY)).exercises.find((e) => e.name === 'Chest press')!;
    expect(await removeExercise(chest.id)).toBe('archived');
    renderProgress();
    await findRegion('Recent PRs');
    await waitFor(() =>
      expect(within(region('Recent PRs')).getAllByRole('listitem')[0]).toHaveTextContent(
        'Chest press',
      ),
    );
    expect(screen.queryByRole('region', { name: 'Stalled' })).not.toBeInTheDocument();
    const select = within(region('Exercise detail')).getByLabelText('Exercise');
    await user.selectOptions(select, 'Chest press (archived)');
    expect(select).toHaveValue(chest.id);
  });

  it('shows weights in the display unit', async () => {
    await seedHistory();
    await updateSettings({ unit: 'kg' });
    renderProgress();
    await findRegion('Stalled');
    const prs = within(region('Recent PRs')).getAllByRole('listitem');
    expect(prs[0]).toHaveTextContent('63.5 kg');
    expect(within(region('Volume')).getByText('762 kg')).toBeInTheDocument();
  });
});
