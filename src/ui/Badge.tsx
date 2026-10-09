import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Badge.module.css';

export interface BadgeProps {
  /** `success` for "PR" and "Add weight"; `neutral` for e.g. "Deload". */
  tone?: 'neutral' | 'success';
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, tone === 'success' && styles.success, className)}>
      {children}
    </span>
  );
}
