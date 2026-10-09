import type { ReactNode } from 'react';
import { cx } from './cx';
import { TopBar, type TopBarProps } from './TopBar';
import styles from './Screen.module.css';

export interface ScreenProps extends Omit<TopBarProps, 'wide'> {
  /**
   * The Progress screen widens to 960px on wide windows (cards may go 2-up);
   * every other screen stays a 480px phone-shaped column.
   */
  wide?: boolean;
  children: ReactNode;
}

/** A tab screen: top bar plus a single padded column. */
export function Screen({ wide, children, ...topBar }: ScreenProps) {
  return (
    <>
      <TopBar {...topBar} wide={wide} />
      <main className={cx(styles.content, wide && styles.wide)}>{children}</main>
    </>
  );
}
