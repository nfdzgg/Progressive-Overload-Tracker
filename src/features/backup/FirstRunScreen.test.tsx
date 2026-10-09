import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSettings, readAllData, wipeAllData } from '../../data';
import { todayISO } from '../../domain';
import { FirstRunScreen } from './FirstRunScreen';

function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true, writable: true });
}

beforeEach(async () => {
  await wipeAllData();
});

afterEach(() => {
  if (Object.prototype.hasOwnProperty.call(navigator, 'storage')) {
    delete (navigator as unknown as Record<string, unknown>).storage;
  }
});

async function waitForOnboarded() {
  await waitFor(async () => expect((await getSettings()).onboarded).toBe(true));
}

describe('FirstRunScreen', () => {
  it('offers the template or a blank start, lb or kg, and one primary action', () => {
    render(<FirstRunScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    const template = screen.getByRole('radio', { name: 'Push / Pull / Legs template' });
    const blank = screen.getByRole('radio', { name: 'Start blank' });
    expect(template).toBeChecked();
    expect(blank).not.toBeChecked();
    expect(template).toHaveAccessibleDescription(/Push, Pull, Legs, Push, Pull, Legs, Rest/);
    expect(template).toHaveAccessibleDescription(/16\sexercises/);
    const unit = screen.getByRole('radiogroup', { name: 'Unit' });
    expect(unit).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('button', { name: 'Get started' })).toHaveLength(1);
  });

  it('template + kg seeds the section 7 template and sets the unit', async () => {
    const user = userEvent.setup();
    render(<FirstRunScreen />);
    await user.click(screen.getByRole('radio', { name: 'kg' }));
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await waitForOnboarded();
    const data = await readAllData(todayISO());
    expect(data.settings.unit).toBe('kg');
    expect(data.exercises).toHaveLength(16);
    expect(data.workouts).toHaveLength(3);
    expect(data.cycle.items).toHaveLength(7);
  });

  it('start blank + lb gives an empty library', async () => {
    const user = userEvent.setup();
    render(<FirstRunScreen />);
    await user.click(screen.getByRole('radio', { name: 'Start blank' }));
    expect(screen.getByRole('radio', { name: 'Start blank' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Push / Pull / Legs template' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await waitForOnboarded();
    const data = await readAllData(todayISO());
    expect(data.settings.unit).toBe('lb');
    expect(data.exercises).toHaveLength(0);
    expect(data.workouts).toHaveLength(0);
    expect(data.cycle.items).toHaveLength(0);
  });

  it('asks for persistent storage after onboarding is saved', async () => {
    let onboardedWhenAsked: boolean | null = null;
    const persist = vi.fn(async () => {
      onboardedWhenAsked = (await getSettings()).onboarded;
      return true;
    });
    setStorage({ persist });
    const user = userEvent.setup();
    render(<FirstRunScreen />);
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onboardedWhenAsked).toBe(true));
  });

  it('still onboards when the Storage API is missing', async () => {
    setStorage(undefined);
    const user = userEvent.setup();
    render(<FirstRunScreen />);
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await waitForOnboarded();
  });
});
