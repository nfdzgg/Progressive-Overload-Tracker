import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_NAMES } from './Icon';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('has an accessible name and optional marker', () => {
    render(
      <>
        <IconButton icon="notes" label="Notes" marker />
        <IconButton icon="more" label="More" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-marker')).toHaveLength(1);
  });

  it('renders every icon as a decorative svg', () => {
    const { container } = render(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    );
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs).toHaveLength(ICON_NAMES.length);
  });
});
