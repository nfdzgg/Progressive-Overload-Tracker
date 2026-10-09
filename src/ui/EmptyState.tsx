import type { ReactNode } from 'react';
import { Text } from './Text';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  /** What will appear here once there is data. */
  message?: ReactNode;
  action?: ReactNode;
}

/** Explains what will appear once there is data; never shows fake numbers. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <Text as="p" variant="body" tone="muted">
        {title}
      </Text>
      {message && (
        <Text as="p" variant="body-sm" tone="subtle">
          {message}
        </Text>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

/** Section label in Settings and the dashboard (eyebrow type). */
export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Text as="h2" id={id} variant="eyebrow" tone="subtle" className={styles.sectionLabel}>
      {children}
    </Text>
  );
}
