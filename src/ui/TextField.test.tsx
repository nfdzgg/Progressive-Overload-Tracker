import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select, TextArea, TextInput } from './TextField';

describe('TextInput, TextArea, Select', () => {
  it('labels controls and reports changes', async () => {
    const onName = vi.fn();
    const onType = vi.fn();
    render(
      <>
        <TextInput label="Name" value="" onValueChange={onName} />
        <TextArea label="Note" value="Seat 4" onValueChange={() => {}} />
        <Select
          label="Type"
          value="legCompound"
          onValueChange={onType}
          options={[
            { value: 'legCompound', label: 'Leg compound' },
            { value: 'upperCompound', label: 'Upper compound' },
          ]}
        />
      </>,
    );
    await userEvent.type(screen.getByLabelText('Name'), 'R');
    expect(onName).toHaveBeenCalledWith('R');
    expect(screen.getByLabelText('Note')).toHaveValue('Seat 4');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'upperCompound');
    expect(onType).toHaveBeenCalledWith('upperCompound');
  });

  it('shows an error message', () => {
    render(<TextInput label="Name" value="" error="Name is required" onValueChange={() => {}} />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });
});
