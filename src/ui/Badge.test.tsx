import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { EmptyState, SectionLabel } from './EmptyState';
import { Text } from './Text';

describe('Badge, Text, EmptyState', () => {
  it('renders badges', () => {
    render(
      <>
        <Badge>Deload</Badge>
        <Badge tone="success">PR</Badge>
      </>,
    );
    expect(screen.getByText('Deload')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('renders text in the requested element', () => {
    render(
      <Text as="h1" variant="headline">
        Push
      </Text>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
  });

  it('renders an empty state and section label', () => {
    render(
      <>
        <SectionLabel>Routine</SectionLabel>
        <EmptyState title="No PRs yet" message="Records appear after your second session." />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Routine' })).toBeInTheDocument();
    expect(screen.getByText('No PRs yet')).toBeInTheDocument();
  });
});
