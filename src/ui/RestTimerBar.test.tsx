import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatCountdown, RestTimerBar } from './RestTimerBar';

describe('RestTimerBar', () => {
  it('shows the exercise, countdown, and dismisses on tap', async () => {
    const onDismiss = vi.fn();
    render(
      <RestTimerBar
        label="Leg press"
        remainingMs={95_000}
        totalMs={180_000}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('Leg press')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('1:35');
    await userEvent.click(screen.getByRole('button', { name: /Rest timer/ }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('stays at 0:00 when done', () => {
    render(<RestTimerBar label="Row" remainingMs={-4000} totalMs={150_000} onDismiss={() => {}} />);
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    expect(screen.getByRole('button')).toHaveAccessibleName(/done/);
  });

  it('formats countdowns', () => {
    expect(formatCountdown(180_000)).toBe('3:00');
    expect(formatCountdown(59_001)).toBe('1:00');
    expect(formatCountdown(500)).toBe('0:01');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
