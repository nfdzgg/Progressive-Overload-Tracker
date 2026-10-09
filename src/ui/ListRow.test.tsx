import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListGroup, ListItem, ListRow } from './ListRow';

describe('ListRow', () => {
  it('renders static and interactive rows', async () => {
    const onClick = vi.fn();
    render(
      <ListGroup label="Exercises">
        <ListItem>
          <ListRow title="Leg press" detail="2 sets · 6–12" chevron onClick={onClick} />
        </ListItem>
        <ListItem>
          <ListRow title="Version" trailing="1.0.0" />
        </ListItem>
      </ListGroup>,
    );
    expect(screen.getByRole('list', { name: 'Exercises' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /Leg press/ }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });
});
