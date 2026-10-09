import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { IconButton } from './IconButton';
import { Screen } from './Screen';
import { TabBar } from './TabBar';

describe('TopBar / Screen', () => {
  it('renders the title, accessory, action, and back button', () => {
    render(
      <Screen
        title="Push"
        accessory={<Badge>Deload</Badge>}
        action={<IconButton icon="plus" label="Add" />}
        onBack={vi.fn()}
      >
        <p>content</p>
      </Screen>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    expect(screen.getByText('Deload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });
});

describe('TabBar', () => {
  it('marks the active tab', () => {
    render(
      <TabBar
        items={[
          { label: 'Today', icon: 'today', href: '#/today', active: true },
          { label: 'Calendar', icon: 'calendar', href: '#/calendar', active: false },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Calendar' })).not.toHaveAttribute('aria-current');
  });
});
