import { cx } from './cx';
import styles from './CalendarDay.module.css';

export interface CalendarDayProps {
  /** Day of month. */
  day: number;
  /** Short workout label ("Push", "Rest"), caption type. */
  label?: string;
  isToday?: boolean;
  /** Rest days and projected (future) days use tertiary ink. */
  muted?: boolean;
  /** Finished session: a 4px green dot. */
  completed?: boolean;
  /** Days outside the shown month. */
  outside?: boolean;
  /** Full accessible description, e.g. "Monday 3 March, Push, finished". */
  ariaLabel: string;
  onClick?: () => void;
}

/** Calendar day cell: date number, short workout label, completed dot. */
export function CalendarDay({
  day,
  label,
  isToday,
  muted,
  completed,
  outside,
  ariaLabel,
  onClick,
}: CalendarDayProps) {
  return (
    <button
      type="button"
      className={cx(
        styles.day,
        muted && styles.muted,
        isToday && styles.today,
        outside && styles.outside,
      )}
      aria-label={ariaLabel}
      aria-current={isToday ? 'date' : undefined}
      onClick={onClick}
    >
      <span className={styles.number}>{day}</span>
      <span className={styles.label}>{label ?? ''}</span>
      <span
        className={cx(styles.dot, completed && styles.dotOn)}
        aria-hidden="true"
        data-testid={completed ? 'completed-dot' : undefined}
      />
    </button>
  );
}
