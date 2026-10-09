import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSession, logEntry, saveCycleItems, saveDraft } from '../../data';
import { todayISO } from '../../domain';
import { cycleNow, exerciseNamed, renderSettings, seedTemplate, workoutNamed } from './testUtils';

beforeEach(async () => {
  await seedTemplate();
});

async function startPush() {
  const push = (await workoutNamed('Push'))!;
  const press = (await exerciseNamed('Chest press'))!;
  const session = await ensureSession(push.id, todayISO());
  const entry = {
    sessionId: session.id,
    slotExerciseId: press.id,
    exerciseId: press.id,
    variantId: press.defaultVariantId,
    unit: 'lb' as const,
    weight: 100,
    sets: [{ reps: 10, weight: null }],
  };
  return { session, entry };
}

describe('Day in cycle (joining partway through the cycle)', () => {
  it('shows where today is and lets the user pick another day', async () => {
    renderSettings();
    const day = await screen.findByRole('button', { name: /Day in cycle/ });
    expect(day).toHaveTextContent('Today: Push, day 1 of 7');
    await userEvent.click(day);
    const sheet = screen.getByRole('dialog', { name: 'Day in cycle' });
    expect(within(sheet).getByRole('button', { name: 'Day 1, Push, today' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Day 2, Pull' }));
    await waitFor(async () => expect((await cycleNow()).pointer).toBe(1));
    expect((await cycleNow()).pointerSince).toBe(todayISO());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Day in cycle/ })).toHaveTextContent(
      'Today: Pull, day 2 of 7',
    );
  });

  it('warns that unlogged numbers in a started workout are cleared, then clears them', async () => {
    const { entry } = await startPush();
    await saveDraft(entry);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Day in cycle/ }));
    const sheet = screen.getByRole('dialog', { name: 'Day in cycle' });
    expect(
      await within(sheet).findByText(/Numbers typed into Push and not logged yet are cleared/),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Day 2, Pull' }));
    await waitFor(async () => expect((await cycleNow()).pointer).toBe(1));
  });

  it('asks to finish a started workout with logged sets first', async () => {
    const { entry } = await startPush();
    await logEntry(entry, todayISO());
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Day in cycle/ }));
    const sheet = screen.getByRole('dialog', { name: 'Day in cycle' });
    expect(
      await within(sheet).findByText(/You have logged sets in today.s Push workout/),
    ).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /Day 2/ })).not.toBeInTheDocument();
    expect((await cycleNow()).pointer).toBe(0);
  });

  it('is not a button while the cycle is empty', async () => {
    await saveCycleItems([], todayISO());
    renderSettings();
    expect(await screen.findByText('Add items to the cycle first')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Day in cycle/ })).not.toBeInTheDocument();
  });
});
