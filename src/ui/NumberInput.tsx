import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './NumberInput.module.css';

export type NumberMode = 'decimal' | 'numeric';

/**
 * Keeps only what a number field may contain while typing:
 * `decimal` (weight) allows one decimal point (a comma becomes a point) and
 * two decimals; `numeric` (reps) allows digits only.
 */
export function sanitizeNumberText(text: string, mode: NumberMode): string {
  if (mode === 'numeric') return text.replace(/\D/g, '').slice(0, 4);
  const cleaned = text.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  const intPart = whole.slice(0, 5);
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join('').slice(0, 2)}`;
}

/** Parses a field value; empty or "." gives null. */
export function parseNumberText(text: string): number | null {
  if (text.trim() === '' || text === '.') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export interface NumberInputProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'onChange' | 'value' | 'type' | 'inputMode'
> {
  /** Accessible name; also the placeholder unless one is given. */
  label: string;
  /** `decimal` for weight, `numeric` for reps. */
  mode: NumberMode;
  value: string;
  onValueChange: (value: string) => void;
  /** Short unit shown inside the field, e.g. "lb". */
  unit?: string;
  invalid?: boolean;
}

/** Weight and per-set rep field: a canvas well with a hairline-strong border. */
export function NumberInput({
  label,
  mode,
  value,
  onValueChange,
  unit,
  invalid,
  placeholder,
  className,
  ...rest
}: NumberInputProps) {
  return (
    <span className={cx(styles.wrap, className)}>
      <input
        type="text"
        inputMode={mode}
        pattern={mode === 'numeric' ? '[0-9]*' : undefined}
        autoComplete="off"
        enterKeyHint="next"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onValueChange(sanitizeNumberText(event.target.value, mode))}
        className={cx(styles.input, unit && styles.withUnit, invalid && styles.invalid)}
        {...rest}
      />
      {unit && (
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      )}
    </span>
  );
}
