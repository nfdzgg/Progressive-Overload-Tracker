import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumberInput, parseNumberText, sanitizeNumberText } from './NumberInput';

function Weight() {
  const [value, setValue] = useState('');
  return (
    <NumberInput label="Weight" mode="decimal" unit="lb" value={value} onValueChange={setValue} />
  );
}

describe('NumberInput', () => {
  it('uses the right keypad and the label as placeholder', () => {
    render(
      <>
        <NumberInput label="Weight" mode="decimal" value="" onValueChange={() => {}} />
        <NumberInput
          label="Set 1"
          mode="numeric"
          placeholder="10"
          value=""
          onValueChange={() => {}}
        />
      </>,
    );
    const weight = screen.getByRole('textbox', { name: 'Weight' });
    expect(weight).toHaveAttribute('inputmode', 'decimal');
    expect(weight).toHaveAttribute('placeholder', 'Weight');
    const reps = screen.getByRole('textbox', { name: 'Set 1' });
    expect(reps).toHaveAttribute('inputmode', 'numeric');
    expect(reps).toHaveAttribute('placeholder', '10');
  });

  it('sanitizes typed text', async () => {
    render(<Weight />);
    const input = screen.getByRole('textbox', { name: 'Weight' });
    await userEvent.type(input, '12a,5.7');
    expect(input).toHaveValue('12.57');
  });

  it('sanitize and parse helpers', () => {
    expect(sanitizeNumberText('1x2', 'numeric')).toBe('12');
    expect(sanitizeNumberText('2.5.5', 'decimal')).toBe('2.55');
    expect(sanitizeNumberText('100,25', 'decimal')).toBe('100.25');
    expect(parseNumberText('')).toBeNull();
    expect(parseNumberText('.')).toBeNull();
    expect(parseNumberText('62.5')).toBe(62.5);
  });
});
