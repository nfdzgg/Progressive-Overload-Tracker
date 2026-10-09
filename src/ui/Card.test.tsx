import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardHeader, DashboardCard } from './Card';
import { IconButton } from './IconButton';

describe('Card', () => {
  it('renders an exercise card with header and actions', () => {
    render(
      <Card variant="exercise">
        <CardHeader title="Chest press" actions={<IconButton icon="more" label="More" />} />
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Chest press' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('renders a dashboard card with label and value', () => {
    render(
      <DashboardCard label="This week" value="3 sessions">
        <p>chart</p>
      </DashboardCard>,
    );
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument();
    expect(screen.getByText('3 sessions')).toBeInTheDocument();
  });

  it('renders the done variant', () => {
    render(<Card variant="exercise-done">done</Card>);
    expect(screen.getByText('done')).toBeInTheDocument();
  });
});
