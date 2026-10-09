import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarDay } from './CalendarDay';

describe('CalendarDay', () => {
  it('renders the day, label, today state, and completed dot', () => {
    render(
      <>
        <CalendarDay day={3} label="Push" isToday completed ariaLabel="3 March, Push, finished" />
        <CalendarDay day={4} label="Rest" muted ariaLabel="4 March, Rest" />
      </>,
    );
    const today = screen.getByRole('button', { name: '3 March, Push, finished' });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(screen.getAllByTestId('completed-dot')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '4 March, Rest' })).toHaveTextContent('4Rest');
  });
});
