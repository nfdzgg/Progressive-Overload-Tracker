import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders each variant as a button and handles clicks', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" onClick={onClick}>
          Log
        </Button>
        <Button variant="secondary">Export</Button>
        <Button variant="tertiary">Cancel</Button>
        <Button variant="destructive">Delete</Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Log' })).toHaveAttribute('type', 'button');
  });

  it('can be disabled', () => {
    render(<Button disabled>Log</Button>);
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled();
  });
});
