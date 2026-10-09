import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../app/pwa';
import { getSettings, saveCycleItems } from '../../data';
import { formatDate, nextMonday, todayISO } from '../../domain';
import { currentPath, cycleNow, renderSettings, seedTemplate } from './testUtils';

beforeEach(async () => {
  await seedTemplate();
});

describe('Settings home', () => {
  it('shows Routine, Preferences, Data, and About in that order', async () => {
    renderSettings();
    await screen.findByText('Push, Pull, Legs, Push, Pull, Legs, Rest');
    const labels = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((t) => ['Routine', 'Preferences', 'Data', 'About'].includes(t ?? ''));
    expect(labels).toEqual(['Routine', 'Preferences', 'Data', 'About']);
    expect(screen.getByText(new RegExp(APP_VERSION.replace(/\./g, '\\.')))).toBeInTheDocument();
    expect(
      screen.getByText(
        /Safari, tap Share, then Add to Home Screen, then Add\. On iOS 26, Share is in the ••• menu and Add to Home Screen is under View More\./,
      ),
    ).toBeInTheDocument();
  });

  it('opens the routine pages', async () => {
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Exercises/ }));
    expect(currentPath()).toBe('/settings/exercises');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(await screen.findByRole('button', { name: /Workouts/ }));
    expect(currentPath()).toBe('/settings/workouts');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(await screen.findByRole('button', { name: /Cycle/ }));
    expect(currentPath()).toBe('/settings/cycle');
  });
});

describe('Preferences', () => {
  it('changes the unit, rest timer, and timer sound', async () => {
    renderSettings();
    const unit = await screen.findByRole('radiogroup', { name: 'Unit' });
    expect(within(unit).getByRole('radio', { name: 'lb' })).toBeChecked();
    await userEvent.click(within(unit).getByRole('radio', { name: 'kg' }));
    await waitFor(async () => expect((await getSettings()).unit).toBe('kg'));
    // The chip follows the stored setting once the live query re-renders.
    await waitFor(() => expect(within(unit).getByRole('radio', { name: 'kg' })).toBeChecked());

    const timer = screen.getByRole('radiogroup', { name: 'Rest timer' });
    await userEvent.click(within(timer).getByRole('radio', { name: 'Off' }));
    await waitFor(async () => expect((await getSettings()).restTimerEnabled).toBe(false));

    const sound = screen.getByRole('radiogroup', { name: 'Timer sound' });
    await userEvent.click(within(sound).getByRole('radio', { name: 'Off' }));
    await waitFor(async () => expect((await getSettings()).restTimerSound).toBe(false));
    await userEvent.click(within(sound).getByRole('radio', { name: 'On' }));
    await waitFor(async () => expect((await getSettings()).restTimerSound).toBe(true));
  });
});

describe('Restart cycle', () => {
  async function movePointerTo(pointer: number) {
    const cycle = await cycleNow();
    await saveCycleItems(cycle.items, todayISO(), pointer);
  }

  it('"Restart today" confirms, then sets the pointer to the first item', async () => {
    await movePointerTo(2);
    renderSettings();
    expect(await screen.findByText(/Next up: Legs/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restart today' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Restart cycle today?' });
    expect(dialog).toHaveTextContent('Today becomes Push, the first item in your cycle');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restart today' }));
    await waitFor(async () => expect((await cycleNow()).pointer).toBe(0));
    expect(await screen.findByText(/Next up: Push/)).toBeInTheDocument();
  });

  it('cancelling leaves the cycle alone', async () => {
    await movePointerTo(2);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Restart today' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await cycleNow()).pointer).toBe(2);
  });

  it('"Restart on Monday" confirms, then schedules the restart', async () => {
    const monday = nextMonday(todayISO());
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Restart on Monday' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Restart on Monday?' });
    expect(dialog).toHaveTextContent(`Until ${formatDate(monday)}, Today shows a rest day`);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restart on Monday' }));
    await waitFor(async () => expect((await cycleNow()).restartOn).toBe(monday));
    expect(
      await screen.findByText(`Restarts from Push on ${formatDate(monday)}.`),
    ).toBeInTheDocument();
  });

  it('is disabled while the cycle is empty', async () => {
    await saveCycleItems([], todayISO());
    renderSettings();
    expect(await screen.findByText('Add items to the cycle first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart today' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restart on Monday' })).toBeDisabled();
  });
});
