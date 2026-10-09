import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useId } from 'react';
import { cx } from './cx';
import styles from './TextField.module.css';

interface FieldFrameProps {
  id: string;
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

function FieldFrame({ id, label, hideLabel, error, hint, children, className }: FieldFrameProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={cx(styles.label, hideLabel && styles.hidden)}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export interface TextInputProps extends Omit<ComponentPropsWithRef<'input'>, 'onChange'> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  onValueChange: (value: string) => void;
}

/** Text field for Settings: surface-1 well, visible label, error caption below. */
export function TextInput({
  label,
  hideLabel,
  error,
  hint,
  onValueChange,
  className,
  id: idProp,
  type = 'text',
  ...rest
}: TextInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldFrame
      id={id}
      label={label}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={className}
    >
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cx(styles.control, error && styles.invalid)}
        onChange={(event) => onValueChange(event.target.value)}
        {...rest}
      />
    </FieldFrame>
  );
}

export interface TextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'onChange'> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  onValueChange: (value: string) => void;
}

/** Multi-line text, e.g. the variant note (seat height, pin setting). */
export function TextArea({
  label,
  hideLabel,
  error,
  hint,
  onValueChange,
  className,
  id: idProp,
  rows = 4,
  ...rest
}: TextAreaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldFrame
      id={id}
      label={label}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={className}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cx(styles.control, styles.textarea, error && styles.invalid)}
        onChange={(event) => onValueChange(event.target.value)}
        {...rest}
      />
    </FieldFrame>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> extends Omit<
  ComponentPropsWithRef<'select'>,
  'onChange' | 'value'
> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
}

/** Native select styled as a text input (exercise type, muscle group, pickers). */
export function Select<T extends string>({
  label,
  hideLabel,
  error,
  options,
  value,
  onValueChange,
  className,
  id: idProp,
  ...rest
}: SelectProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldFrame id={id} label={label} hideLabel={hideLabel} error={error} className={className}>
      <span className={styles.selectWrap}>
        <select
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          className={cx(styles.control, styles.select, error && styles.invalid)}
          onChange={(event) => onValueChange(event.target.value as T)}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          width={20}
          height={20}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5.5 9.5L12 16l6.5-6.5" />
        </svg>
      </span>
    </FieldFrame>
  );
}
