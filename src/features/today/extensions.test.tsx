import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeFirstRun,
  db,
  getInProgressSession,
  readAllData,
  swapSlot,
  wipeAllData,
} from '../../data';
import { todayISO, type Session } from '../../domain';
import {
  registerTodayExtensions,
  type EntryLoggedEvent,
  type SetCommittedEvent,
  type TodayCardContext,
} from './extensions';
import { TodayScreen } from './index';

const TODAY = todayISO();

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayScreen />
    </MemoryRouter>,
  );
}

const inCard = (name: string) => within(screen.getByRole('article', { name }));

/** Stand-in for Session extras: a button per card that records its context. */
const contexts = new Map<string, TodayCardContext>();
function FakeActions(context: TodayCardContext) {
  contexts.set(context.slotExerciseId, context);
  return (
    <button type="button" aria-label={`More for ${context.exercise.name}`}>
      {context.variant.name}|{context.session ? 'session' : 'no session'}|
      {context.entry?.status ?? 'no entry'}
    </button>
  );
}

function FakeAccessory({ session }: { session: Session | null }) {
  return <span>{session ? 'Accessory: session' : 'Accessory: none'}</span>;
}

beforeEach(async () => {
  await wipeAllData();
  contexts.clear();
  registerTodayExtensions({
    CardHeaderActions: undefined,
    TopBarAccessory: undefined,
    onSetCommitted: undefined,
    onEntryLogged: undefined,
  });
  await completeFirstRun('template', 'lb', TODAY);
});

describe('Today extensions', () => {
  it('renders registered card header actions on every card, with the card context', async () => {
    registerTodayExtensions({ CardHeaderActions: FakeActions });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(screen.getAllByRole('button', { name: /^More for / })).toHaveLength(6);

    const chest = inCard('Chest press');
    expect(chest.getByRole('button', { name: 'More for Chest press' })).toHaveTextContent(
      'Machine|no session|no entry',
    );
    await user.click(chest.getByRole('radio', { name: 'Bench' }));
    expect(chest.getByRole('button', { name: 'More for Chest press' })).toHaveTextContent(
      'Bench|no session|no entry',
    );

    const { exercises, workouts } = await readAllData(TODAY);
    const chestPress = exercises.find((e) => e.name === 'Chest press')!;
    const ctx = contexts.get(chestPress.id)!;
    expect(ctx.workoutId).toBe(workouts.find((w) => w.name === 'Push')!.id);
    expect(ctx.exercise.id).toBe(chestPress.id);

    // ensureSession creates the session on demand.
    const session = await ctx.ensureSession();
    expect(await getInProgressSession()).toMatchObject({ id: session.id });
    await waitFor(() =>
      expect(chest.getByRole('button', { name: 'More for Chest press' })).toHaveTextContent(
        'Bench|session|no entry',
      ),
    );
  });

  it('header actions stay on done cards and do not reopen them', async () => {
    registerTodayExtensions({ CardHeaderActions: FakeActions });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const row = inCard('Chest press');
    await user.type(row.getByLabelText('Set 1 reps'), '10');
    await user.click(row.getByRole('button', { name: 'Log Chest press' }));
    await row.findByText('BW × 10');
    const more = row.getByRole('button', { name: 'More for Chest press' });
    expect(more).toHaveTextContent('Machine|session|logged');
    await user.click(more);
    expect(row.queryByLabelText('Weight')).not.toBeInTheDocument();
    expect((await db.entries.toArray())[0].status).toBe('logged');
  });

  it('renders the top bar accessory with the current session', async () => {
    registerTodayExtensions({ TopBarAccessory: FakeAccessory });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    expect(screen.getByRole('banner')).toHaveTextContent('Accessory: none');
    await user.type(inCard('Chest press').getByLabelText('Weight'), '1');
    await waitFor(() => expect(screen.getByRole('banner')).toHaveTextContent('Accessory: session'));
  });

  it('fires onSetCommitted when a reps field other than the last is filled and loses focus', async () => {
    const onSetCommitted = vi.fn<(event: SetCommittedEvent) => void>();
    registerTodayExtensions({ onSetCommitted });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const chest = inCard('Chest press');

    await user.click(chest.getByLabelText('Set 1 reps'));
    await user.tab(); // empty: nothing to commit
    expect(onSetCommitted).not.toHaveBeenCalled();

    await user.type(chest.getByLabelText('Set 1 reps'), '10');
    expect(onSetCommitted).not.toHaveBeenCalled();
    await user.click(chest.getByLabelText('Set 2 reps'));
    expect(onSetCommitted).toHaveBeenCalledTimes(1);
    expect(onSetCommitted.mock.calls[0][0]).toMatchObject({
      exercise: { name: 'Chest press' },
      setIndex: 0,
      restSeconds: 150,
    });

    // The last set never commits; refocusing an unchanged field does not either.
    await user.type(chest.getByLabelText('Set 2 reps'), '9');
    await user.click(chest.getByLabelText('Set 1 reps'));
    await user.click(chest.getByLabelText('Weight'));
    expect(onSetCommitted).toHaveBeenCalledTimes(1);
  });

  it('fires onEntryLogged after Log with the saved entry, rest, and PRs', async () => {
    const onEntryLogged = vi.fn<(event: EntryLoggedEvent) => void>();
    registerTodayExtensions({ onEntryLogged });
    const user = userEvent.setup();
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const raise = inCard('Lateral raise');
    await user.type(raise.getByLabelText('Weight'), '15');
    await user.type(raise.getByLabelText('Set 1 reps'), '12');
    await user.click(raise.getByRole('button', { name: 'Log Lateral raise' }));
    await waitFor(() => expect(onEntryLogged).toHaveBeenCalledTimes(1));
    const event = onEntryLogged.mock.calls[0][0];
    expect(event.exercise.name).toBe('Lateral raise');
    expect(event.restSeconds).toBe(90);
    expect(event.prs).toEqual([]);
    expect(event.entry).toMatchObject({ status: 'logged', weight: 15 });
  });

  it('a swapped slot shows the performed exercise but keeps the slot in the context', async () => {
    registerTodayExtensions({ CardHeaderActions: FakeActions });
    const { exercises } = await readAllData(TODAY);
    const chest = exercises.find((e) => e.name === 'Chest press')!;
    const legPress = exercises.find((e) => e.name === 'Leg press')!;
    renderToday();
    await screen.findByRole('heading', { level: 1, name: 'Push' });
    const session = await contexts.get(chest.id)!.ensureSession();
    await swapSlot(session.id, chest.id, legPress.id, 'lb');

    const card = await screen.findByRole('article', { name: 'Leg press' });
    expect(screen.queryByRole('article', { name: 'Chest press' })).not.toBeInTheDocument();
    expect(within(card).getByRole('radio', { name: 'Downstairs machine' })).toBeChecked();
    expect(contexts.get(chest.id)).toMatchObject({
      slotExerciseId: chest.id,
      exercise: { id: legPress.id },
    });

    const user = userEvent.setup();
    await user.type(within(card).getByLabelText('Set 1 reps'), '12');
    await user.click(within(card).getByRole('button', { name: 'Log Leg press' }));
    await within(card).findByText('BW × 12');
    const entry = (await db.entries.toArray())[0];
    expect(entry).toMatchObject({
      exerciseId: legPress.id,
      swappedFromExerciseId: chest.id,
      status: 'logged',
    });
  });
});
