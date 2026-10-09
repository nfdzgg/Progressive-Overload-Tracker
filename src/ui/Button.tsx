import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` is the lavender action: at most one per card or sheet.
   * `secondary` for Export/Import/Add, `tertiary` for Cancel/Skip,
   * `destructive` for Delete/Restart (always followed by a confirmation).
   */
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  fullWidth,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], fullWidth && styles.fullWidth, className)}
      {...rest}
    />
  );
}
