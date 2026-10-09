import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLoggedEntry,
  completeFirstRun,
  createPastSession,
  db,
  ensureSession,
  finishSession,
  getCycle,
  readAllData,
  restartCycleOnMonday,
  setSessionDeload,
  wipeAllData,
} from '../../data';
import type { SetLog } from '../../domain';
import { CalendarScreen } from './CalendarScreen';

// 2026-03-04 is a Wednesday. Only Date is faked; timers stay real for Dexie.
const TODAY = '2026-03-04';
const MONDAY = '2026-03-02';
const TUESDAY = '2026-03-03';

/** Renders the Calendar tab and waits for the live queries to load. */
async function renderCalendar() {
  render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  );
  await screen.findByRole('region', { name: 'This week' });
}

async function routine() {
  const data = await readAllData(TODAY);
  return {
    exercise: (name: string) => data.exercises.find((e) => e.name === name)!,
    workout: (name: string) => data.workouts.find((w) => w.name === name)!,
  };
}

const reps = (...values: number[]): SetLog[] => values.map((r) => ({ reps: r, weight: null }));

/** A finished past session with logged entries. */
async function seedSession(
  date: string,
  workoutName: string,
  entries: Array<{ exercise: string; variant: string; weight: number | null; sets: SetLog[] }>,
) {
  const { exercise, workout } = await routine();
  const session = await createPastSession(date, workout(workoutName).id);
  for (const e of entries) {
    const ex = exercise(e.exercise);
    await addLoggedEntry({
      sessionId: session.id,
      exerciseId: ex.id,
      variantId: ex.variants.find((v) => v.name === e.variant)!.id,
      unit: 'lb',
      weight: e.weight,
      sets: e.sets,
    });
  }
  return session;
}

const week = () => within(screen.getByRole('region', { name: 'This week' }));
const month = (name = 'March 2026') => within(screen.getByRole('region', { name }));
const sheet = (name: string) => within(screen.getByRole('dialog', { name }));
/** Waits for the sheet (its title changes when a view switches) and an element in it. */
const findInSheet = (sheetName: string, role: string, name: string | RegExp) =>
  waitFor(() => sheet(sheetName).getByRole(role, { name }));
const days = (region: ReturnType<typeof week>) =>
  region.getAllByRole('button', { name: /^\w+day, \w+ \d+/ });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 4, 9));
  await wipeAllData();
  await completeFirstRun('template', 'lb', TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendar month and week (6.4, 5.2)', () => {
  it('shows the current week at the top and the month below, with the projection', async () => {
    await renderCalendar();
    await screen.findByRole('region', { name: 'This week' });
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();

    expect(days(week()).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Monday, March 2',
      'Tuesday, March 3',
      'Wednesday, March 4, today, Push, planned',
      'Thursday, March 5, Pull, planned',
      'Friday, March 6, Legs, planned',
      'Saturday, March 7, Push, planned',
      'Sunday, March 8, Pull, planned',
    ]);
    const today = week().getByRole('button', { name: /today/ });
    expect(today).toHaveAttribute('aria-current', 'date');

    expect(days(month())).toHaveLength(31);
    expect(
      month().getByRole('button', { name: 'Monday, March 9, Legs, planned' }),
    ).toHaveTextContent('9Legs');
    expect(month().getByRole('button', { name: 'Tuesday, March 10, Rest' })).toHaveTextContent(
      '10Rest',
    );
    expect(
      month().getByRole('button', { name: 'Wednesday, March 11, Push, planned' }),
    ).toBeVisible();
    // Past days without a session show no label.
    expect(month().getByRole('button', { name: 'Sunday, March 1' })).toHaveTextContent(/^1$/);
  });

  it('marks a finished session and starts the projection tomorrow', async () => {
    const { workout } = await routine();
    const session = await ensureSession(workout('Push').id, TODAY);
    await finishSession(session.id, TODAY);
    await renderCalendar();

    const today = await week().findByRole('button', {
      name: 'Wednesday, March 4, today, Push, finished',
    });
    expect(within(today).getByTestId('completed-dot')).toBeInTheDocument();
    expect(
      days(week())
        .slice(3)
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Thursday, March 5, Pull, planned',
      'Friday, March 6, Legs, planned',
      'Saturday, March 7, Push, planned',
      'Sunday, March 8, Pull, planned',
    ]);
    expect(month().getByRole('button', { name: 'Monday, March 9, Legs, planned' })).toBeVisible();
    expect(month().getByRole('button', { name: 'Tuesday, March 10, Rest' })).toBeVisible();
  });

  it('shows past sessions with a count when a day has several', async () => {
    await seedSession(MONDAY, 'Push', []);
    vi.setSystemTime(new Date(2026, 2, 4, 10));
    await seedSession(MONDAY, 'Pull', []);
    await renderCalendar();
    const monday = await week().findByRole('button', {
      name: 'Monday, March 2, Push, Pull, finished',
    });
    expect(monday).toHaveTextContent('Push +1');
  });

  it('moves between months; the projection continues into the next month', async () => {
    const user = userEvent.setup();
    await renderCalendar();
    await screen.findByRole('region', { name: 'March 2026' });

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      month('April 2026').getByRole('button', { name: 'Wednesday, April 1, Push, planned' }),
    ).toBeInTheDocument();
    expect(days(month('April 2026'))).toHaveLength(30);
    // The week strip stays on the current week.
    expect(week().getByRole('button', { name: /today/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(days(month('February 2026'))).toHaveLength(28);
    expect(
      month('February 2026').getByRole('button', { name: 'Saturday, February 28' }),
    ).toHaveTextContent(/^28$/);
  });
});

describe('day sheets', () => {
  it("lists a past day's entries; an entry's reps and variant can be edited", async () => {
    const user = userEvent.setup();
    await seedSession(MONDAY, 'Push', [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
      { exercise: 'Lateral raise', variant: 'Cable', weight: 15, sets: reps(12, 12) },
    ]);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Monday, March 2, Push, finished' }),
    );

    const day = sheet('Monday, March 2');
    expect(day.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    const rows = day.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual([
      'Chest pressMachine · 100 lb × 10, 9',
      'Incline pressNot logged',
      'Chest flyNot logged',
      'Lateral raiseCable · 15 lb × 12, 12',
      'Tricep overhead cable extensionNot logged',
      'Tricep pushdownNot logged',
    ]);

    await user.click(day.getByRole('button', { name: 'Chest press, Machine · 100 lb × 10, 9' }));
    const editor = sheet('Chest press');
    expect(editor.getByText('Push · Monday, March 2')).toBeInTheDocument();
    expect(editor.getByLabelText('Weight')).toHaveValue('100');
    expect(editor.getByLabelText('Set 1 reps')).toHaveValue('10');
    await user.clear(editor.getByLabelText('Set 2 reps'));
    await user.type(editor.getByLabelText('Set 2 reps'), '11');
    await user.click(editor.getByRole('radio', { name: 'Bench' }));
    await user.click(editor.getByRole('button', { name: 'Save' }));

    await findInSheet('Monday, March 2', 'button', 'Chest press, Bench · 100 lb × 10, 11');
    const { entries } = await readAllData(TODAY);
    const chest = entries.find((e) => e.weight === 100)!;
    expect(chest.sets.map((s) => s.reps)).toEqual([10, 11]);
    expect(chest.status).toBe('logged');
  });

  it('cancel leaves the entry unchanged; Save needs reps', async () => {
    const user = userEvent.setup();
    await seedSession(MONDAY, 'Push', [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
    ]);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Monday, March 2, Push, finished' }),
    );
    await user.click(
      sheet('Monday, March 2').getByRole('button', { name: /^Chest press, Machine/ }),
    );
    const editor = sheet('Chest press');
    await user.clear(editor.getByLabelText('Set 1 reps'));
    await user.clear(editor.getByLabelText('Set 2 reps'));
    expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(
      sheet('Monday, March 2').getByRole('button', {
        name: 'Chest press, Machine · 100 lb × 10, 9',
      }),
    ).toBeInTheDocument();
  });

  it('deletes an entry after confirming', async () => {
    const user = userEvent.setup();
    await seedSession(MONDAY, 'Push', [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
      { exercise: 'Lateral raise', variant: 'Cable', weight: 15, sets: reps(12, 12) },
    ]);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Monday, March 2, Push, finished' }),
    );
    await user.click(
      sheet('Monday, March 2').getByRole('button', { name: /^Lateral raise, Cable/ }),
    );
    await user.click(sheet('Lateral raise').getByRole('button', { name: 'Delete entry' }));

    const confirm = within(screen.getByRole('alertdialog', { name: 'Delete this entry?' }));
    expect(
      confirm.getByText('Lateral raise on Monday, March 2 will be removed from your history.'),
    ).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: 'Delete entry' }));

    await findInSheet('Monday, March 2', 'button', 'Lateral raise, Not logged');
    const { entries } = await readAllData(TODAY);
    expect(entries.map((e) => e.weight)).toEqual([100]);
  });

  it('deletes a whole session after confirming; the day can then get a new one', async () => {
    const user = userEvent.setup();
    await seedSession(MONDAY, 'Push', [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
    ]);
    const before = await getCycle(TODAY);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Monday, March 2, Push, finished' }),
    );
    await user.click(sheet('Monday, March 2').getByRole('button', { name: 'Delete session' }));
    const confirm = within(screen.getByRole('alertdialog', { name: 'Delete this session?' }));
    await user.click(confirm.getByRole('button', { name: 'Delete session' }));

    await findInSheet('Monday, March 2', 'button', 'Add Push');
    const data = await readAllData(TODAY);
    expect(data.sessions).toHaveLength(0);
    expect(data.entries).toHaveLength(0);
    expect(await getCycle(TODAY)).toEqual(before);
    expect(week().getByRole('button', { name: 'Monday, March 2' })).toBeInTheDocument();
  });

  it('a skipped entry given reps becomes logged; deload sessions are marked', async () => {
    const user = userEvent.setup();
    const { workout } = await routine();
    const session = await ensureSession(workout('Push').id, TODAY);
    await setSessionDeload(session.id, true);
    await finishSession(session.id, TODAY);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Wednesday, March 4, today, Push, finished' }),
    );

    const day = sheet('Wednesday, March 4');
    expect(day.getByText('Deload')).toBeInTheDocument();
    await user.click(day.getByRole('button', { name: 'Chest fly, Skipped' }));
    const editor = sheet('Chest fly');
    expect(editor.getByLabelText('Weight')).toHaveValue('');
    await user.type(editor.getByLabelText('Weight'), '50');
    await user.type(editor.getByLabelText('Set 1 reps'), '12');
    await user.click(editor.getByRole('button', { name: 'Save' }));

    await findInSheet('Wednesday, March 4', 'button', 'Chest fly, Downstairs machine · 50 lb × 12');
    const fly = (await readAllData(TODAY)).entries.find((e) => e.weight === 50)!;
    expect(fly.status).toBe('logged');
    expect(fly.unit).toBe('lb');
  });

  it('per-set weight entries edit one weight per set', async () => {
    const user = userEvent.setup();
    await seedSession(MONDAY, 'Legs', [
      {
        exercise: 'Incline bench crunch',
        variant: 'Incline bench',
        weight: null,
        sets: [
          { reps: 15, weight: 10 },
          { reps: 12, weight: null },
        ],
      },
    ]);
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Monday, March 2, Legs, finished' }),
    );
    await user.click(
      sheet('Monday, March 2').getByRole('button', {
        name: 'Incline bench crunch, Incline bench · 10 lb × 15, BW × 12',
      }),
    );
    const editor = sheet('Incline bench crunch');
    expect(editor.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect(editor.getByLabelText('Set 1 weight')).toHaveValue('10');
    expect(editor.getByLabelText('Set 2 weight')).toHaveValue('');
    await user.type(editor.getByLabelText('Set 2 weight'), '5');
    await user.click(editor.getByRole('button', { name: 'Save' }));
    await findInSheet(
      'Monday, March 2',
      'button',
      'Incline bench crunch, Incline bench · 10 lb × 15, 5 lb × 12',
    );
  });

  it('adds a session to an empty past day and logs an exercise; the cycle does not move', async () => {
    const user = userEvent.setup();
    const before = await getCycle(TODAY);
    await renderCalendar();
    await user.click(await week().findByRole('button', { name: 'Tuesday, March 3' }));

    const day = sheet('Tuesday, March 3');
    expect(day.getByText(/Nothing logged on this day/)).toBeInTheDocument();
    expect(
      day.getAllByRole('button', { name: /^Add / }).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Add Push', 'Add Pull', 'Add Legs']);
    expect(day.getByRole('button', { name: 'Add Pull' })).toHaveTextContent('6 exercises');
    await user.click(day.getByRole('button', { name: 'Add Pull' }));

    const added = await findInSheet('Tuesday, March 3', 'heading', 'Pull');
    expect(added).toBeInTheDocument();
    await user.click(
      sheet('Tuesday, March 3').getByRole('button', { name: 'Lat pulldown, Not logged' }),
    );
    const editor = sheet('Lat pulldown');
    expect(editor.getByRole('radio', { name: 'Wide grip' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(editor.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument();
    const log = editor.getByRole('button', { name: 'Log' });
    expect(log).toBeDisabled();
    await user.click(editor.getByRole('radio', { name: 'Short grip' }));
    await user.type(editor.getByLabelText('Weight'), '120');
    await user.type(editor.getByLabelText('Set 1 reps'), '10');
    await user.type(editor.getByLabelText('Set 2 reps'), '8');
    await user.click(log);

    await findInSheet('Tuesday, March 3', 'button', 'Lat pulldown, Short grip · 120 lb × 10, 8');
    const data = await readAllData(TODAY);
    expect(data.sessions).toMatchObject([
      { date: TUESDAY, workoutName: 'Pull', status: 'finished' },
    ]);
    expect(data.entries).toMatchObject([
      { date: TUESDAY, status: 'logged', weight: 120, unit: 'lb' },
    ]);
    expect(await getCycle(TODAY)).toEqual(before);
    await waitFor(() =>
      expect(
        week().getByRole('button', { name: 'Tuesday, March 3, Pull, finished' }),
      ).toBeInTheDocument(),
    );
  });

  it('a future day shows the planned workout, read-only', async () => {
    const user = userEvent.setup();
    await renderCalendar();
    await user.click(
      await week().findByRole('button', { name: 'Thursday, March 5, Pull, planned' }),
    );
    const day = sheet('Thursday, March 5');
    expect(day.getByRole('heading', { name: 'Pull' })).toBeInTheDocument();
    expect(day.getByText('Planned')).toBeInTheDocument();
    expect(day.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Lat pulldown2 sets · 6–12 reps',
      'Row2 sets · 6–12 reps',
      'Rear delt fly2 sets · 10–15 reps',
      'Lateral raise2 sets · 10–15 reps',
      'Curl2 sets · 10–15 reps',
      'Hammer curl2 sets · 10–15 reps',
    ]);
    expect(day.queryAllByRole('button')).toHaveLength(0);
    expect(day.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('today without a session shows the plan; rest days say so', async () => {
    const user = userEvent.setup();
    await renderCalendar();
    await user.click(await week().findByRole('button', { name: /today, Push, planned/ }));
    expect(sheet('Wednesday, March 4').getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(sheet('Wednesday, March 4').queryByText(/Add a session/)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(month().getByRole('button', { name: 'Tuesday, March 10, Rest' }));
    expect(sheet('Tuesday, March 10').getByText('Rest day')).toBeInTheDocument();
  });

  it('days waiting for a scheduled restart are rest days that say when it restarts', async () => {
    const user = userEvent.setup();
    await restartCycleOnMonday(TODAY);
    await renderCalendar();
    await user.click(await week().findByRole('button', { name: 'Saturday, March 7, Rest' }));
    const day = sheet('Saturday, March 7');
    expect(day.getByText('Rest day')).toBeInTheDocument();
    expect(day.getByText('The cycle restarts on Monday, March 9.')).toBeInTheDocument();
    expect(
      month().getByRole('button', { name: 'Monday, March 9, Push, planned' }),
    ).toBeInTheDocument();
  });

  it('an empty cycle plans nothing', async () => {
    const user = userEvent.setup();
    await db.cycle.update('cycle', { items: [], pointer: 0 });
    await renderCalendar();
    await user.click(await week().findByRole('button', { name: 'Friday, March 6' }));
    const day = sheet('Friday, March 6');
    expect(day.getByText('Nothing planned')).toBeInTheDocument();
    expect(day.getByText('Add workouts to the cycle in Settings.')).toBeInTheDocument();
  });
});
