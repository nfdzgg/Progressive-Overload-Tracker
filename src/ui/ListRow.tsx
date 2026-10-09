import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import styles from './ListRow.module.css';

export interface ListRowProps {
  title: ReactNode;
  /** Secondary line in subtle ink. */
  detail?: ReactNode;
  /** Something at the leading edge (rarely needed). */
  leading?: ReactNode;
  /** Value, badge, or controls at the trailing edge. */
  trailing?: ReactNode;
  /** Makes the whole row a button. */
  onClick?: () => void;
  /** Shows a chevron (navigates somewhere). */
  chevron?: boolean;
  /** Danger-colored title for a destructive row. */
  destructive?: boolean;
  /** Accessible name when the row is a button and the title is not enough. */
  ariaLabel?: string;
  className?: string;
}

/** Row in Settings, exercise history, and the PR list: 44px min, hairline rule below. */
export function ListRow({
  title,
  detail,
  leading,
  trailing,
  onClick,
  chevron,
  destructive,
  ariaLabel,
  className,
}: ListRowProps) {
  const content = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.text}>
        <span className={cx(styles.title, destructive && styles.destructive)}>{title}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {chevron && (
        <span className={styles.chevron}>
          <Icon name="chevronRight" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cx(styles.row, styles.interactive, className)}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }
  return <div className={cx(styles.row, className)}>{content}</div>;
}

/** A list of rows; the last row drops its rule. */
export function ListGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.group} role="list" aria-label={label}>
      {children}
    </div>
  );
}

/** Wraps a row for use inside ListGroup. */
export function ListItem({ children }: { children: ReactNode }) {
  return (
    <div role="listitem" className={styles.item}>
      {children}
    </div>
  );
}
