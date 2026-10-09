import type { ReactNode } from 'react';
import { IconButton } from '../../ui';
import styles from './Settings.module.css';

/** A reorderable list inside a settings group. */
export function EditList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="list" aria-label={label} className={styles.list}>
      {children}
    </div>
  );
}

export interface EditRowProps {
  /** Item name, used for the title and the buttons' accessible names. */
  name: string;
  /** Accessible name of the row (defaults to `name`). */
  rowLabel?: string;
  detail?: ReactNode;
  /** E.g. the position number. */
  leading?: ReactNode;
  /** E.g. a "Next" or "Default" badge after the title. */
  badge?: ReactNode;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  /** Extra icon buttons after the move buttons (remove, edit). */
  actions?: ReactNode;
}

/** Row with move up / move down buttons (no drag and drop: simple and accessible). */
export function EditRow({
  name,
  rowLabel,
  detail,
  leading,
  badge,
  index,
  count,
  onMove,
  actions,
}: EditRowProps) {
  return (
    <div role="listitem" aria-label={rowLabel ?? name} className={styles.row}>
      {leading !== undefined && (
        <span className={styles.leading} aria-hidden="true">
          {leading}
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.title}>
          {name}
          {badge}
        </span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      <span className={styles.actions}>
        <IconButton
          icon="arrowUp"
          label={`Move ${name} up`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        />
        <IconButton
          icon="arrowDown"
          label={`Move ${name} down`}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        />
        {actions}
      </span>
    </div>
  );
}
