import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart, ComparisonBars } from './BarChart';
import { LineChart } from './LineChart';
import { niceTicks } from './scale';

describe('LineChart', () => {
  it('draws series, PR points, and muted points', () => {
    const { container } = render(
      <LineChart
        ariaLabel="Estimated 1RM over time"
        series={[
          {
            id: 'e1rm',
            name: 'e1RM',
            tone: 'primary',
            points: [
              { x: 1, y: 100 },
              { x: 2, y: 110, highlight: true },
              { x: 3, y: 105, muted: true },
            ],
          },
          { id: 'top', name: 'Top weight', tone: 'secondary', points: [{ x: 1, y: 90 }] },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Estimated 1RM over time' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-series]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-pr]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-muted]')).toHaveLength(1);
  });

  it('shows a tooltip for the inspected point via keyboard', () => {
    render(
      <LineChart
        ariaLabel="chart"
        formatY={(v) => `${v} lb`}
        series={[{ id: 'a', name: 'Top weight', tone: 'primary', points: [{ x: 1, y: 100 }] }]}
      />,
    );
    fireEvent.keyDown(screen.getByRole('img'), { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('Top weight100 lb');
  });

  it('renders an empty chart without crashing', () => {
    render(<LineChart ariaLabel="empty" series={[]} />);
    expect(screen.getByRole('img', { name: 'empty' })).toBeInTheDocument();
  });
});

describe('BarChart and ComparisonBars', () => {
  it('renders bars with values and marks the current one', () => {
    const { container } = render(
      <BarChart
        ariaLabel="Weekly volume"
        bars={[
          { label: 'W1', value: 1000 },
          { label: 'W2', value: 1500, current: true },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Weekly volume' })).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-current]')).toHaveLength(1);
  });

  it('renders comparison rows', () => {
    render(
      <ComparisonBars
        ariaLabel="Sets per muscle group"
        currentLabel="This week"
        previousLabel="Last week"
        rows={[{ label: 'Chest', current: 8, previous: 6 }]}
      />,
    );
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});

describe('niceTicks', () => {
  it('produces round ticks covering the range', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 25, 50, 75, 100]);
    const ticks = niceTicks(97, 113, 3);
    expect(ticks[0]).toBeLessThanOrEqual(97);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(113);
  });
});
