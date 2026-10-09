import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLoggedEntry,
  completeFirstRun,
  createPastSession,
  db,
  ensureSession,
  getInProgressSession,
  readAllData,
  skipSlot,
  updateSettings,
  wipeAllData,
} from '../../data';
import { addDays, todayISO, type Exercise, type Session } from '../../domain';
import { TodayScreen } from '../today';
import { DeloadBadge } from './DeloadBadge';
// Importing the slice registers its Today extensions.
import './index';
import { restAlert } from './restAlert';
import { restTimerStore } from './restTimer';
import { ShellOverlay } from './ShellOverlay';

// jsdom cannot play audio: the app's alert is a stand-in for this file.
vi.mock('./restAlert', () => ({
  restAlert: { prime: vi.fn(), fire: vi.fn(), isUnlocked: () => false },
}));

const TODAY = todayISO();

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayScreen />
      <ShellOverlay />
    </MemoryRouter>,
  );
}

const card = (name: string) => screen.getByRole('article', { name });
const inCard = (name: string) => within(card(name));
const sheet = () => screen.getByRole('dialog');

async function exercisesByName(): Promise<Map<string, Exercise>> {
  const { exercises } = await readAllData(TODAY);
  return new Map(exercises.map((e) => [e.name, e]));
}

async function openToday() {
  const user = userEvent.setup();
  renderToday();
  await screen.findByRole('heading', { level: 1, name: 'Push' });
  return user;
}

beforeEach(async () => {
  await wipeAllData();
  await completeFirstRun('template', 'lb', TODAY);
  // After the awaits, so a timer started at the end of the previous test is gone too.
  restTimerStore.dismiss();
});

describe('card header actions', () => {
  it('every card has a notes and a more icon, also when done', async () => {
    const user = await openToday();
    expect(screen.getAllByRole('button', { name: /^Notes for / })).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /^More for / })).toHaveLength(6);

    await user.type(inCard('Chest press').getByLabelText('Set 1 reps'), '10');
    await user.click(inCard('Chest press').getByRole('button', { name: 'Log Chest press' }));
    await inCard('Chest press').findByText('BW × 10');
    expect(inCard('Chest press').getByRole('button', { name: /^Notes for / })).toBeInTheDocument();
    expect(inCard('Chest press').getByRole('button', { name: /^More for / })).toBeInTheDocument();
  });
});

describe('notes sheet', () => {
  it('saves the note for the selected variant and shows the marker', async () => {
    const user = await openToday();
    const notes = () => inCard('Chest press').getByRole('button', { name: /^Notes for / });
    expect(within(notes()).queryByTestId('icon-marker')).not.toBeInTheDocument();

    await user.click(notes());
    expect(within(sheet()).getByRole('heading', { name: 'Chest press · Machine' })).toBeVisible();
    const field = within(sheet()).getByLabelText('Note');
    expect(field).toHaveValue('');
    await user.type(field, 'Seat 4, pin 7');
    await user.click(within(sheet()).getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const chest = (await exercisesByName()).get('Chest press')!;
    expect(chest.variants.find((v) => v.name === 'Machine')!.note).toBe('Seat 4, pin 7');
    expect(chest.variants.find((v) => v.name === 'Bench')!.note).toBe('');
    await waitFor(() => expect(within(notes()).getByTestId('icon-marker')).toBeInTheDocument());
    expect(notes()).toHaveAccessibleName('Notes for Chest press, has a note');
    // The note is never shown inline on the card.
    expect(card('Chest press')).not.toHaveTextContent('Seat 4');

    // Notes are per variant.
    await user.click(inCard('Chest press').getByRole('radio', { name: 'Bench' }));
    expect(within(notes()).queryByTestId('icon-marker')).not.toBeInTheDocument();
    await user.click(notes());
    expect(within(sheet()).getByRole('heading', { name: 'Chest press · Bench' })).toBeVisible();
    expect(within(sheet()).getByLabelText('Note')).toHaveValue('');
    await user.keyboard('{Escape}');

    await user.click(inCard('Chest press').getByRole('radio', { name: 'Machine' }));
    await user.click(notes());
    expect(within(sheet()).getByLabelText('Note')).toHaveValue('Seat 4, pin 7');
  });

  it('closing without saving keeps the old note', async () => {
    const user = await openToday();
    await user.click(inCard('Chest fly').getByRole('button', { name: /^Notes for / }));
    await user.type(within(sheet()).getByLabelText('Note'), 'Draft');
    await user.keyboard('{Escape}');
    const fly = (await exercisesByName()).get('Chest fly')!;
    expect(fly.variants.every((v) => v.note === '')).toBe(true);
  });
});

describe('more menu', () => {
  it('skip for today marks the card skipped', async () => {
    const user = await openToday();
    await user.click(inCard('Incline press').getByRole('button', { name: /^More for / }));
    expect(within(sheet()).getByRole('heading', { name: 'Incline press' })).toBeVisible();
    await user.click(within(sheet()).getByRole('button', { name: 'Skip for today' }));
    expect(await inCard('Incline press').findByText('Skipped')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ status: 'skipped' });
    expect(await getInProgressSession()).toMatchObject({ id: entry.sessionId });

    // A done card offers no skip.
    await user.click(inCard('Incline press').getByRole('button', { name: /^More for / }));
    expect(
      within(sheet()).queryByRole('button', { name: 'Skip for today' }),
    ).not.toBeInTheDocument();
  });

  it('skipping the last open exercise finishes the session', async () => {
    const user = await openToday();
    const byName = await exercisesByName();
    const { workouts } = await readAllData(TODAY);
    const push = workouts.find((w) => w.name === 'Push')!;
    const session = await ensureSession(push.id, TODAY);
    for (const id of push.exerciseIds.slice(0, -1)) await skipSlot(session.id, id, TODAY);
    const last = [...byName.values()].find((e) => e.id === push.exerciseIds.at(-1))!;
    const lastCard = await screen.findByRole('article', { name: last.name });
    await waitFor(() => expect(within(card('Chest press')).getByText('Skipped')).toBeVisible());
    await user.click(within(lastCard).getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: 'Skip for today' }));
    expect(await screen.findByText('Workout finished')).toBeInTheDocument();
  });

  it('swap for today records the log against the exercise performed; swap back undoes it', async () => {
    const user = await openToday();
    const byName = await exercisesByName();
    await user.click(inCard('Chest press').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: 'Swap for today' }));

    // The library, without the exercise being performed.
    expect(
      await within(sheet()).findByRole('heading', { name: 'Instead of Chest press' }),
    ).toBeVisible();
    // The picker lists the library from a live query; wait for it to load.
    const options = await within(sheet()).findByRole('list', { name: 'Exercises' });
    await waitFor(() =>
      expect(within(options).getAllByRole('button')).toHaveLength(byName.size - 1),
    );
    expect(within(options).queryByRole('button', { name: /^Chest press/ })).not.toBeInTheDocument();
    await user.click(within(options).getByRole('button', { name: /^Leg press/ }));

    const legPress = await screen.findByRole('article', { name: 'Leg press' });
    expect(screen.queryByRole('article', { name: 'Chest press' })).not.toBeInTheDocument();
    await user.type(within(legPress).getByLabelText('Set 1 reps'), '12');
    await user.click(within(legPress).getByRole('button', { name: 'Log Leg press' }));
    await within(legPress).findByText('BW × 12');
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({
      exerciseId: byName.get('Leg press')!.id,
      swappedFromExerciseId: byName.get('Chest press')!.id,
      status: 'logged',
    });

    // Swapping back discards the logged numbers, so it asks first.
    await user.click(within(legPress).getByRole('button', { name: /^More for / }));
    await user.click(
      await within(sheet()).findByRole('button', { name: 'Swap back to Chest press' }),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('The numbers entered for Leg press are discarded.');
    await user.click(within(confirm).getByRole('button', { name: 'Swap' }));
    expect(await screen.findByRole('article', { name: 'Chest press' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Leg press' })).not.toBeInTheDocument();
    await waitFor(async () => expect(await db.entries.count()).toBe(0));
  });

  it('cancelling the swap confirmation keeps the typed numbers', async () => {
    const user = await openToday();
    await user.type(inCard('Chest press').getByLabelText('Set 1 reps'), '8');
    await waitFor(async () => expect(await db.entries.count()).toBe(1));
    await user.click(inCard('Chest press').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: 'Swap for today' }));
    await user.click(await within(sheet()).findByRole('button', { name: /^Row/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(inCard('Chest press').getByLabelText('Set 1 reps')).toHaveValue('8');
    expect((await db.entries.toArray())[0].sets[0].reps).toBe(8);
  });

  it('a swap without typed numbers needs no confirmation; Back returns to the menu', async () => {
    const user = await openToday();
    await user.click(inCard('Lateral raise').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: 'Swap for today' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Back' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Swap for today' }));
    await user.click(within(sheet()).getByRole('button', { name: /^Hammer curl/ }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Hammer curl' })).toBeInTheDocument();
  });

  it('mark session as deload shows the Deload badge; it can be unmarked', async () => {
    const user = await openToday();
    const banner = screen.getByRole('banner');
    expect(within(banner).queryByText('Deload')).not.toBeInTheDocument();

    await user.click(inCard('Chest fly').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: /^Mark session as deload/ }));
    expect(await within(banner).findByText('Deload')).toBeInTheDocument();
    expect((await getInProgressSession())?.deload).toBe(true);

    // It applies to the whole session: every card's menu offers to unmark it.
    await user.click(inCard('Tricep pushdown').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: /^Unmark deload/ }));
    await waitFor(() => expect(within(banner).queryByText('Deload')).not.toBeInTheDocument());
    expect((await getInProgressSession())?.deload).toBe(false);
  });

  it('a logged entry in a deload session earns no PR', async () => {
    const byName = await exercisesByName();
    const chest = byName.get('Chest press')!;
    const { workouts } = await readAllData(TODAY);
    const past = await createPastSession(
      addDays(TODAY, -4),
      workouts.find((w) => w.name === 'Push')!.id,
    );
    await addLoggedEntry({
      sessionId: past.id,
      exerciseId: chest.id,
      variantId: chest.defaultVariantId,
      unit: 'lb',
      weight: 100,
      sets: [
        { reps: 10, weight: null },
        { reps: 9, weight: null },
      ],
    });
    const user = await openToday();
    await user.click(inCard('Chest press').getByRole('button', { name: /^More for / }));
    await user.click(within(sheet()).getByRole('button', { name: /^Mark session as deload/ }));
    await within(screen.getByRole('banner')).findByText('Deload');

    const chestCard = inCard('Chest press');
    await waitFor(() => expect(chestCard.getByLabelText('Weight')).toHaveValue('100'));
    await user.type(chestCard.getByLabelText('Set 1 reps'), '12');
    await user.type(chestCard.getByLabelText('Set 2 reps'), '12');
    await user.click(chestCard.getByRole('button', { name: 'Log Chest press' }));
    await chestCard.findByText('100 lb × 12, 12');
    expect(chestCard.queryByText('PR')).not.toBeInTheDocument();
  });
});

describe('deload badge (top bar accessory)', () => {
  const session: Session = {
    id: 's',
    date: TODAY,
    workoutId: 'w',
    workoutName: 'Push',
    deload: false,
    status: 'inProgress',
    createdAt: 1,
  };

  it('shows only for a deload session', () => {
    const { rerender, container } = render(<DeloadBadge session={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DeloadBadge session={session} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DeloadBadge session={{ ...session, deload: true }} />);
    expect(screen.getByText('Deload')).toBeInTheDocument();
  });
});

describe('rest timer from Today', () => {
  it('starts when a set other than the last is committed, and again on Log', async () => {
    const user = await openToday();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    const raise = inCard('Lateral raise');
    await user.type(raise.getByLabelText('Set 1 reps'), '12');
    await user.click(raise.getByLabelText('Set 2 reps'));
    const bar = await screen.findByRole('button', { name: /^Rest timer, Lateral raise/ });
    expect(within(bar).getByRole('timer')).toHaveTextContent('1:30');
    expect(restAlert.prime).toHaveBeenCalled();

    restTimerStore.dismiss();
    await waitFor(() => expect(screen.queryByRole('timer')).not.toBeInTheDocument());
    await user.click(inCard('Chest press').getByLabelText('Set 1 reps'));
    await user.keyboard('9');
    await user.click(inCard('Chest press').getByRole('button', { name: 'Log Chest press' }));
    const next = await screen.findByRole('button', { name: /^Rest timer, Chest press/ });
    expect(within(next).getByRole('timer')).toHaveTextContent('2:30');
  });

  it('does not start when the rest timer is off in Settings', async () => {
    await updateSettings({ restTimerEnabled: false });
    const user = await openToday();
    const raise = inCard('Lateral raise');
    await user.type(raise.getByLabelText('Set 1 reps'), '12');
    await user.click(raise.getByLabelText('Set 2 reps'));
    await user.type(raise.getByLabelText('Set 2 reps'), '10');
    await user.click(raise.getByRole('button', { name: 'Log Lateral raise' }));
    await raise.findByText('BW × 12, 10');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(restTimerStore.getTimer()).toBeNull();
  });
});
