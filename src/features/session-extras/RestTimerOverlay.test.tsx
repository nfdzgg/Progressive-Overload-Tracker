import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createRestTimerStore, STALE_AFTER_MS, type RestTimerStore } from './restTimer';
import { RestTimerOverlay, TICK_MS } from './RestTimerOverlay';

const T0 = new Date('2026-03-02T09:00:00');
const ON = { restTimerEnabled: true, restTimerSound: true };

let store: RestTimerStore;
let alert: {
  prime: Mock<() => void>;
  fire: Mock<(sound: boolean) => void>;
  isUnlocked: () => boolean;
};

beforeEach(() => {
  // Only the interval and the clock are faked (IndexedDB is not used here).
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: T0 });
  store = createRestTimerStore({ storage: null });
  alert = { prime: vi.fn(), fire: vi.fn(), isUnlocked: () => false };
});

afterEach(() => {
  vi.useRealTimers();
});

function renderOverlay(settings: typeof ON | undefined = ON) {
  return render(<RestTimerOverlay store={store} alert={alert} settings={settings} />);
}

/** Moves the clock and lets the interval tick. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const countdown = () => screen.getByRole('timer');

describe('rest timer overlay', () => {
  it('shows nothing without a running timer', () => {
    const { container } = renderOverlay();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the exercise and the countdown, which follows the clock', () => {
    renderOverlay();
    act(() => store.start('Chest press', 150_000));
    expect(screen.getByRole('button', { name: /Rest timer, Chest press/ })).toBeInTheDocument();
    expect(screen.getByText('Chest press')).toBeInTheDocument();
    expect(countdown()).toHaveTextContent('2:30');
    advance(1_000);
    expect(countdown()).toHaveTextContent('2:29');
    advance(59_000);
    expect(countdown()).toHaveTextContent('1:30');
  });

  it('at zero alerts once with the sound, then stays at 0:00 in green', () => {
    renderOverlay();
    act(() => store.start('Row', 90_000));
    advance(89_000);
    expect(alert.fire).not.toHaveBeenCalled();
    advance(1_000);
    expect(alert.fire).toHaveBeenCalledTimes(1);
    expect(alert.fire).toHaveBeenCalledWith(true);
    expect(countdown()).toHaveTextContent('0:00');
    expect(countdown().className).toMatch(/done/);
    expect(screen.getByRole('button', { name: /Rest timer, Row, 0:00, done/ })).toBeInTheDocument();
    advance(60_000);
    expect(alert.fire).toHaveBeenCalledTimes(1);
    expect(countdown()).toHaveTextContent('0:00');
  });

  it('with the timer sound off, zero only vibrates', () => {
    renderOverlay({ restTimerEnabled: true, restTimerSound: false });
    act(() => store.start('Row', 90_000));
    advance(90_000);
    expect(alert.fire).toHaveBeenCalledWith(false);
  });

  it('tap dismisses it', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderOverlay();
    act(() => store.start('Row', 90_000));
    await user.click(screen.getByRole('button', { name: /Rest timer/ }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(store.getTimer()).toBeNull();
  });

  it('a new start replaces the running one', () => {
    renderOverlay();
    act(() => store.start('Chest press', 150_000));
    advance(30_000);
    act(() => store.start('Incline press', 150_000));
    expect(screen.getByText('Incline press')).toBeInTheDocument();
    expect(screen.queryByText('Chest press')).not.toBeInTheDocument();
    expect(countdown()).toHaveTextContent('2:30');
  });

  it('recomputes when the app returns to the foreground; zero passed while hidden is silent', () => {
    renderOverlay();
    act(() => store.start('Row', 90_000));
    // Hidden: no ticks run, then the clock has jumped well past zero.
    vi.setSystemTime(T0.getTime() + 120_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(countdown()).toHaveTextContent('0:00');
    expect(alert.fire).not.toHaveBeenCalled();
  });

  it('turning the timer off in Settings hides and dismisses it', () => {
    const { rerender } = renderOverlay();
    act(() => store.start('Row', 90_000));
    expect(countdown()).toBeInTheDocument();
    rerender(
      <RestTimerOverlay
        store={store}
        alert={alert}
        settings={{ restTimerEnabled: false, restTimerSound: true }}
      />,
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(store.getTimer()).toBeNull();
  });

  it('drops a timer that finished long ago when the app returns', () => {
    renderOverlay();
    act(() => store.start('Row', 90_000));
    advance(90_000);
    vi.setSystemTime(T0.getTime() + 90_000 + STALE_AFTER_MS + 1_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('unlocks audio on any tap (iOS plays sound only after a gesture)', () => {
    renderOverlay();
    fireEvent.click(document.body);
    fireEvent.touchEnd(document.body);
    expect(alert.prime).toHaveBeenCalledTimes(2);
  });

  it('ticks quickly enough for a smooth countdown', () => {
    expect(TICK_MS).toBeLessThanOrEqual(500);
  });
});
