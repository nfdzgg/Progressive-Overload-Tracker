import { Icon } from './Icon';
import styles from './RestTimerBar.module.css';

/** Formats milliseconds as m:ss, rounding up so 0:00 means done. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface RestTimerBarProps {
  /** Exercise name. */
  label: string;
  remainingMs: number;
  totalMs: number;
  /** Tapping the bar dismisses it. */
  onDismiss: () => void;
}

/**
 * Compact rest timer bar: exercise name, mono countdown, dismiss control, and
 * a 2px lavender progress line along the top. At zero the countdown turns
 * green; the bar itself does not flash or change fill.
 */
export function RestTimerBar({ label, remainingMs, totalMs, onDismiss }: RestTimerBarProps) {
  const done = remainingMs <= 0;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const countdown = formatCountdown(remainingMs);
  return (
    <button
      type="button"
      className={styles.bar}
      onClick={onDismiss}
      aria-label={`Rest timer, ${label}, ${countdown}${done ? ', done' : ' remaining'}. Tap to dismiss.`}
    >
      <span
        className={styles.progress}
        style={{ width: `${fraction * 100}%` }}
        aria-hidden="true"
        data-testid="rest-timer-progress"
      />
      <span className={styles.label}>{label}</span>
      <span className={done ? `${styles.countdown} ${styles.done}` : styles.countdown} role="timer">
        {countdown}
      </span>
      <span className={styles.dismiss} aria-hidden="true">
        <Icon name="close" />
      </span>
    </button>
  );
}
