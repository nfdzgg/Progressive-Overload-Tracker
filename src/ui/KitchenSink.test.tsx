import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KitchenSink } from './KitchenSink';

describe('KitchenSink', () => {
  it('renders every component section', () => {
    render(<KitchenSink />);
    for (const label of [
      'Typography',
      'Buttons',
      'Exercise cards',
      'Inputs',
      'Lists',
      'Dashboard',
      'Calendar',
      'Overlays',
    ]) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    }
  });
});
