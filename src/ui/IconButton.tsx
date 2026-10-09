import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name; icon buttons have no visible text. */
  label: string;
  size?: 'card' | 'tab';
  /** A subtle dot, e.g. "a note exists". */
  marker?: boolean;
}

/** Circular icon button with a 44px hit area. */
export function IconButton({
  icon,
  label,
  size = 'card',
  marker,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, className)}
      {...rest}
    >
      <Icon name={icon} size={size} />
      {marker && <span className={styles.marker} data-testid="icon-marker" aria-hidden="true" />}
    </button>
  );
}
