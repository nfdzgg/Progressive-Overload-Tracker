import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Chip, ChipGroup } from './Chip';

function Variants() {
  const [value, setValue] = useState('machine');
  return (
    <ChipGroup
      label="Variant"
      value={value}
      onChange={setValue}
      options={[
        { value: 'machine', label: 'Machine' },
        { value: 'bench', label: 'Bench' },
      ]}
    />
  );
}

describe('Chip', () => {
  it('renders a pressed state', () => {
    render(<Chip selected>Cable</Chip>);
    expect(screen.getByRole('button', { name: 'Cable' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ChipGroup behaves as a radio group', async () => {
    render(<Variants />);
    expect(screen.getByRole('radiogroup', { name: 'Variant' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Machine' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Bench' }));
    expect(screen.getByRole('radio', { name: 'Bench' })).toBeChecked();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Machine' })).toBeChecked();
  });
});
