import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Grow, Inline, Stack, VisuallyHidden } from './Layout';

describe('Layout', () => {
  it('renders stacks and rows', () => {
    render(
      <Stack gap="xl" as="section">
        <Inline gap="xs" justify="between" wrap>
          <Grow>left</Grow>
          <span>right</span>
        </Inline>
        <VisuallyHidden>hidden label</VisuallyHidden>
      </Stack>,
    );
    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('hidden label')).toBeInTheDocument();
  });
});
