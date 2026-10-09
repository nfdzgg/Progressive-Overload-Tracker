import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLoggedEntry,
  completeFirstRun,
  createPastSession,
  db,
  deleteWorkout,
  ensureSession,
  getCycle,
  getInProgressSession,
  readAllData,
  restartCycleOnMonday,
  saveCycleItems,
  saveDraft,
  updateExercise,
  wipeAllData,
} from '../../data';
import { addDays, todayISO, type SetLog } from '../../domain';
import { registerTodayExtensions } from './extensions';
import { TodayScreen } from './TodayScreen';

const TODAY = todayISO();
const PUSH = [
  'Chest press',
  'Incline press',
  'Chest fly',
  'Lateral raise',
  'Tricep overhead cable extension',
  'Tricep pushdown',
];

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayScreen />
    </MemoryRouter>,
  );
}

async function routine() {
  const data = await readAllData(TODAY);
  return {
    exercise: (name: string) => data.exercises.find((e) => e.name === name)!,
    workout: (name: string) => data.workouts.find((w) => w.name === name)!,
  };
}

const reps = (...values: Array<number | null>): SetLog[] =>
  values.map((r) => ({ reps: r, weight: null }));

/** A finished past session with logged entries, for references and PRs. */
async function seedHistory(
  daysAgo: number,
  entries: Array<{ exercise: string; variant: string; weight: number | null; sets: SetLog[] }>,
) {
  const { exercise, workout } = await routine();
  const session = await createPastSession(addDays(TODAY, -daysAgo), workout('Push').id);
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
}

async function moveToItem(index: number) {
  const cycle = await getCycle(TODAY);
  await saveCycleItems(cycle.items, TODAY, index);
}

const card = (name: string) => screen.getByRole('article', { name });
const inCard = (name: string) => within(card(name));

beforeEach(async () => {
  await wipeAllData();
  registerTodayExtensions({
    CardHeaderActions: undefined,
    TopBarAccessory: undefined,
    onSetCommitted: undefined,
    onEntryLogged: undefined,
  });
  await completeFirstRun('template', 'lb', TODAY);
});

describe('workout at the pointer', () => {
  it('title is the workout name and the body is one card per exercise, in order', async () => {
    renderToday();
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 2 }).textContent)).toEqual(
      PUSH,
    );
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
  });

  it('variant chips preselect the default; a single variant shows no chips', async () => {
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chips = inCard('Chest press').getByRole('radiogroup', { name: 'Variant' });
    expect(within(chips).getByRole('radio', { name: 'Machine' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(chips).getByRole('radio', { name: 'Bench' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(inCard('Incline press').queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('without history: "Nothing logged this way yet", no prefill, set labels as placeholders', async () => {
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    expect(chest.getByText('Nothing logged this way yet')).toBeInTheDocument();
    expect(chest.getByLabelText('Weight')).toHaveValue('');
    expect(chest.getByLabelText('Weight')).toHaveAttribute('inputmode', 'decimal');
    expect(chest.getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', 'Set 1');
    expect(chest.getByLabelText('Set 2 reps')).toHaveAttribute('inputmode', 'numeric');
    expect(chest.getByRole('button', { name: 'Log Chest press' })).toBeDisabled();
  });

  it('an untouched day leaves no session behind', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    await user.click(inCard('Chest press').getByRole('radio', { name: 'Bench' }));
    expect(await getInProgressSession()).toBeUndefined();
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('drafts', () => {
  it('typing creates the session and saves a draft; a reload shows the typed values', async () => {
    const user = userEvent.setup();
    const first = renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    await user.type(inCard('Chest press').getByLabelText('Weight'), '102.5');
    await user.type(inCard('Chest press').getByLabelText('Set 1 reps'), '10');

    await waitFor(async () => {
      const entries = await db.entries.toArray();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ status: 'draft', weight: 102.5, sets: reps(10, null) });
    });
    const session = await getInProgressSession();
    expect(session).toMatchObject({ date: TODAY, workoutName: 'Push' });
    // Typing kept focus and every keystroke while the session was created.
    expect(inCard('Chest press').getByLabelText('Set 1 reps')).toHaveFocus();
    expect(await db.sessions.count()).toBe(1);

    first.unmount();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(inCard('Chest press').getByLabelText('Weight')).toHaveValue('102.5');
    expect(inCard('Chest press').getByLabelText('Set 1 reps')).toHaveValue('10');
    expect(inCard('Chest press').getByLabelText('Set 2 reps')).toHaveValue('');
  });

  it('resumes an in-progress session from an earlier date', async () => {
    const { workout, exercise } = await routine();
    const session = await ensureSession(workout('Pull').id, addDays(TODAY, -2));
    const row = exercise('Row');
    await saveDraft({
      sessionId: session.id,
      slotExerciseId: row.id,
      exerciseId: row.id,
      variantId: row.defaultVariantId,
      unit: 'lb',
      weight: 80,
      sets: reps(8, null),
    });
    renderToday();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pull' })).toBeInTheDocument();
    expect(inCard('Row').getByLabelText('Weight')).toHaveValue('80');
    expect(inCard('Row').getByLabelText('Set 1 reps')).toHaveValue('8');
  });

  it("falls back to the session's entries when its workout was deleted", async () => {
    const { workout, exercise } = await routine();
    const session = await ensureSession(workout('Push').id, TODAY);
    const chest = exercise('Chest press');
    await saveDraft({
      sessionId: session.id,
      slotExerciseId: chest.id,
      exerciseId: chest.id,
      variantId: chest.defaultVariantId,
      unit: 'lb',
      weight: 100,
      sets: reps(10, null),
    });
    await deleteWorkout(workout('Push').id, TODAY);
    renderToday();
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(inCard('Chest press').getByLabelText('Weight')).toHaveValue('100');
  });
});

describe('live data', () => {
  it('untouched cards follow new history and set counts without a reload', async () => {
    const { exercise } = await routine();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(inCard('Chest press').getByLabelText('Weight')).toHaveValue('');

    await seedHistory(3, [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
    ]);
    await waitFor(() => expect(inCard('Chest press').getByLabelText('Weight')).toHaveValue('100'));
    expect(inCard('Chest press').getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', '10');

    await updateExercise(exercise('Chest press').id, { sets: 3 });
    expect(await inCard('Chest press').findByLabelText('Set 3 reps')).toHaveAttribute(
      'placeholder',
      'Set 3',
    );
  });

  it('an edited card keeps what was typed when the set count changes', async () => {
    const { exercise } = await routine();
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    await user.type(inCard('Chest press').getByLabelText('Weight'), '90');
    await user.type(inCard('Chest press').getByLabelText('Set 1 reps'), '7');
    await updateExercise(exercise('Chest press').id, { sets: 3 });
    expect(await inCard('Chest press').findByLabelText('Set 3 reps')).toHaveValue('');
    expect(inCard('Chest press').getByLabelText('Weight')).toHaveValue('90');
    expect(inCard('Chest press').getByLabelText('Set 1 reps')).toHaveValue('7');
  });
});

describe('reference and target per variant', () => {
  it('chips swap the reference line, target, prefill, and placeholders', async () => {
    await seedHistory(3, [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
      { exercise: 'Chest press', variant: 'Bench', weight: 135, sets: reps(12, 12) },
    ]);
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    expect(chest.getByText('Last: 100 lb × 10, 9 · Beat: +1 rep')).toBeInTheDocument();
    expect(chest.getByLabelText('Weight')).toHaveValue('100');
    expect(chest.getByLabelText('Set 1 reps')).toHaveValue('');
    expect(chest.getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', '10');
    expect(chest.getByLabelText('Set 2 reps')).toHaveAttribute('placeholder', '9');

    await user.click(chest.getByRole('radio', { name: 'Bench' }));
    expect(chest.getByText('Last: 135 lb × 12, 12')).toBeInTheDocument();
    expect(chest.getByText('Add weight')).toBeInTheDocument();
    expect(chest.queryByText(/Beat/)).not.toBeInTheDocument();
    expect(chest.getByLabelText('Weight')).toHaveValue('135');
    expect(chest.getByLabelText('Set 1 reps')).toHaveAttribute('placeholder', '12');

    // Another exercise's other variant has its own (empty) history.
    expect(inCard('Chest fly').getByText('Nothing logged this way yet')).toBeInTheDocument();
  });

  it('switching the chip on a draft saves the new variant into it', async () => {
    await seedHistory(3, [
      { exercise: 'Chest press', variant: 'Bench', weight: 135, sets: reps(10, 10) },
    ]);
    const { exercise } = await routine();
    const bench = exercise('Chest press').variants.find((v) => v.name === 'Bench')!;
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    await user.type(chest.getByLabelText('Set 1 reps'), '8');
    await user.click(chest.getByRole('radio', { name: 'Bench' }));
    expect(chest.getByLabelText('Set 1 reps')).toHaveValue('8');
    await waitFor(async () => {
      const [entry] = await db.entries.where('status').equals('draft').toArray();
      expect(entry).toMatchObject({ variantId: bench.id, weight: 135, sets: reps(8, null) });
    });
  });

  it('a deload session is never the reference', async () => {
    await seedHistory(5, [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
    ]);
    await seedHistory(2, [
      { exercise: 'Chest press', variant: 'Machine', weight: 60, sets: reps(12, 12) },
    ]);
    const sessions = await db.sessions.orderBy('date').toArray();
    await db.sessions.update(sessions[1].id, { deload: true });
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(inCard('Chest press').getByText(/^Last: 100 lb × 10, 9/)).toBeInTheDocument();
  });
});

describe('Log and done state', () => {
  it('requires reps; collapses to the logged numbers; tapping reopens it for editing', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    await user.type(chest.getByLabelText('Weight'), '100');
    expect(chest.getByRole('button', { name: 'Log Chest press' })).toBeDisabled();
    await user.type(chest.getByLabelText('Set 1 reps'), '10');
    await user.type(chest.getByLabelText('Set 2 reps'), '8');
    await user.click(chest.getByRole('button', { name: 'Log Chest press' }));

    expect(await chest.findByText('100 lb × 10, 8')).toBeInTheDocument();
    expect(chest.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect(chest.queryByText('PR')).not.toBeInTheDocument();
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ status: 'logged', unit: 'lb', weight: 100, sets: reps(10, 8) });

    await user.click(chest.getByRole('button', { name: 'Edit Chest press' }));
    expect(await chest.findByLabelText('Weight')).toHaveValue('100');
    expect(chest.getByLabelText('Set 2 reps')).toHaveValue('8');
    expect((await db.entries.get(entry.id))?.status).toBe('draft');
  });

  it('weight may be left empty (bodyweight)', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const fly = inCard('Chest fly');
    await user.type(fly.getByLabelText('Set 1 reps'), '15');
    await user.click(fly.getByRole('button', { name: 'Log Chest fly' }));
    expect(await fly.findByText('BW × 15')).toBeInTheDocument();
    const [entry] = await db.entries.toArray();
    expect(entry.weight).toBeNull();
  });

  it('entries are saved in the unit setting', async () => {
    await db.settings.update('settings', { unit: 'kg' });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    await user.type(chest.getByLabelText('Weight'), '40');
    await user.type(chest.getByLabelText('Set 1 reps'), '10');
    await user.click(chest.getByRole('button', { name: 'Log Chest press' }));
    expect(await chest.findByText('40 kg × 10')).toBeInTheDocument();
    expect((await db.entries.toArray())[0]).toMatchObject({ unit: 'kg', weight: 40 });
  });

  it('shows the PR badge when the entry beats history, and keeps it after a reload', async () => {
    await seedHistory(3, [
      { exercise: 'Chest press', variant: 'Machine', weight: 100, sets: reps(10, 9) },
    ]);
    const user = userEvent.setup();
    const first = renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');
    await user.type(chest.getByLabelText('Set 1 reps'), '11');
    await user.type(chest.getByLabelText('Set 2 reps'), '9');
    await user.click(chest.getByRole('button', { name: 'Log Chest press' }));
    expect(await chest.findByText('100 lb × 11, 9')).toBeInTheDocument();
    expect(chest.getByText('PR')).toBeInTheDocument();

    first.unmount();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(inCard('Chest press').getByText('PR')).toBeInTheDocument();
  });

  it('per-set weight: each set has its own weight field', async () => {
    await moveToItem(2); // Legs
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Legs' });
    const crunch = inCard('Incline bench crunch');
    expect(crunch.queryByLabelText('Weight')).not.toBeInTheDocument();
    await user.type(crunch.getByLabelText('Set 1 weight'), '10');
    await user.type(crunch.getByLabelText('Set 1 reps'), '12');
    await user.type(crunch.getByLabelText('Set 2 reps'), '10');
    await user.click(crunch.getByRole('button', { name: 'Log Incline bench crunch' }));
    expect(await crunch.findByText('10 lb × 12, BW × 10')).toBeInTheDocument();
    expect((await db.entries.toArray())[0]).toMatchObject({
      weight: null,
      sets: [
        { reps: 12, weight: 10 },
        { reps: 10, weight: null },
      ],
    });
  });
});

describe('finishing', () => {
  it('logging every card finishes the session and shows the summary; Start next workout', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    for (const name of PUSH) {
      await user.type(inCard(name).getByLabelText('Weight'), '50');
      await user.type(inCard(name).getByLabelText('Set 1 reps'), '10');
      await user.type(inCard(name).getByLabelText('Set 2 reps'), '9');
      await user.click(inCard(name).getByRole('button', { name: `Log ${name}` }));
      if (name !== PUSH[PUSH.length - 1]) await inCard(name).findByText('50 lb × 10, 9');
    }

    expect(await screen.findByText('Workout finished')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Finished workout' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(PUSH.length);
    expect(within(list).getAllByText('50 lb × 10, 9')).toHaveLength(PUSH.length);
    expect((await db.sessions.toArray())[0].status).toBe('finished');
    expect((await getCycle(TODAY)).pointer).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Start next workout' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pull' })).toBeInTheDocument();
  });

  it('Finish workout confirms, then marks unlogged exercises skipped', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    await user.type(inCard('Chest press').getByLabelText('Set 1 reps'), '10');
    await user.click(inCard('Chest press').getByRole('button', { name: 'Log Chest press' }));
    await inCard('Chest press').findByText('BW × 10');

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Finish workout?' });
    expect(dialog).toHaveTextContent('5 exercises are not logged. They will be marked as skipped.');
    await user.click(within(dialog).getByRole('button', { name: 'Finish' }));

    expect(await screen.findByText('Workout finished')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Finished workout' });
    expect(within(list).getAllByText('Skipped')).toHaveLength(5);
    expect(within(list).getByText('BW × 10')).toBeInTheDocument();
  });

  it('Finish on an untouched workout creates the session and skips everything', async () => {
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await db.sessions.count()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Workout finished')).toBeInTheDocument();
    expect(await db.entries.where('status').equals('skipped').count()).toBe(PUSH.length);
  });

  it('a skipped card shows "Skipped" and can be reopened', async () => {
    const { workout, exercise } = await routine();
    const session = await ensureSession(workout('Push').id, TODAY);
    const chest = exercise('Chest press');
    await db.entries.add({
      id: 'skip-1',
      sessionId: session.id,
      date: TODAY,
      exerciseId: chest.id,
      variantId: chest.defaultVariantId,
      unit: 'lb',
      weight: null,
      sets: [],
      status: 'skipped',
      swappedFromExerciseId: null,
      createdAt: 1,
    });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(inCard('Chest press').getByText('Skipped')).toBeInTheDocument();
    await user.click(inCard('Chest press').getByRole('button', { name: 'Edit Chest press' }));
    expect(await inCard('Chest press').findByLabelText('Weight')).toHaveValue('');
  });
});

describe('other states', () => {
  it('rest day offers Train anyway', async () => {
    await moveToItem(6);
    const user = userEvent.setup();
    renderToday();
    expect(await screen.findByRole('heading', { level: 1, name: 'Rest day' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Train anyway' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
  });

  it('waiting for a scheduled restart offers Start now', async () => {
    await moveToItem(3);
    const cycle = await restartCycleOnMonday(TODAY);
    const user = userEvent.setup();
    renderToday();
    expect(await screen.findByRole('heading', { level: 1, name: 'Rest' })).toBeInTheDocument();
    expect(screen.getByText(/^The cycle restarts /)).toBeInTheDocument();
    expect(cycle.restartOn).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start now' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    expect((await getCycle(TODAY)).restartOn).toBeNull();
  });

  it('an empty cycle points to Settings', async () => {
    await completeFirstRun('blank', 'lb', TODAY);
    renderToday();
    expect(await screen.findByText('No workouts in your cycle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
  });
});
