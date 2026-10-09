import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';
import styles from './TopBar.module.css';

export interface TopBarProps {
  /** Screen title at the left (for Today, the workout name). */
  title: string;
  /** Small element next to the title, e.g. a "Deload" badge. */
  accessory?: ReactNode;
  /** At most one icon action at the right. */
  action?: ReactNode;
  /** Shows a back button before the title (nested Settings pages). */
  onBack?: () => void;
  backLabel?: string;
  /** Widens the bar to the Progress column on wide windows. */
  wide?: boolean;
}

/** Flat bar; gains a hairline bottom rule once content scrolls beneath it. */
export function TopBar({
  title,
  accessory,
  action,
  onBack,
  backLabel = 'Back',
  wide,
}: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cx(styles.bar, scrolled && styles.scrolled, wide && styles.wide)}
      data-scrolled={scrolled}
    >
      <div className={styles.inner}>
        {onBack && (
          <span className={styles.back}>
            <IconButton icon="back" label={backLabel} size="tab" onClick={onBack} />
          </span>
        )}
        <h1 className={styles.title}>{title}</h1>
        {accessory && <span className={styles.accessory}>{accessory}</span>}
        <span className={styles.spacer} />
        {action && <span className={styles.action}>{action}</span>}
      </div>
    </header>
  );
}
