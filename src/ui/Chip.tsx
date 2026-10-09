import type { ComponentPropsWithRef, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { cx } from './cx';
import styles from './Chip.module.css';

export interface ChipProps extends ComponentPropsWithRef<'button'> {
  selected?: boolean;
}

/** Pill chip. Selection is shown by surface lift, not color. */
export function Chip({ selected, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={rest.role ? undefined : selected}
      className={cx(styles.chip, selected && styles.selected, className)}
      {...rest}
    />
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  /** Accessible name for the group, e.g. "Variant" or "Range". */
  label: string;
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Single-select row of chips (variant chips, range switch, on/off and unit
 * choices). Behaves as a radio group: arrow keys move the selection.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ChipGroupProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.group, className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            selected={selected}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </Chip>
        );
      })}
    </div>
  );
}
