import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ShellOverlay } from '../features/session-extras';
import { TabBar, type TabItem } from '../ui';
import { cx } from '../ui/cx';
import { useKeyboardOpen } from './useKeyboardOpen';
import styles from './Shell.module.css';

const TABS: Array<Omit<TabItem, 'active'> & { path: string }> = [
  { label: 'Today', icon: 'today', href: '#/today', path: '/today' },
  { label: 'Calendar', icon: 'calendar', href: '#/calendar', path: '/calendar' },
  { label: 'Progress', icon: 'progress', href: '#/progress', path: '/progress' },
  { label: 'Settings', icon: 'settings', href: '#/settings', path: '/settings' },
];

/**
 * App frame: the routed screen, then a fixed bottom stack holding the shell
 * overlay (rest timer) above the tab bar. Both hide while the on-screen
 * keyboard is open.
 */
export function Shell() {
  const { pathname } = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bottomHeight, setBottomHeight] = useState(0);
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const measure = () => setBottomHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Each tab starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const items = TABS.map(({ path, ...tab }) => ({
    ...tab,
    active: pathname === path || pathname.startsWith(`${path}/`),
  }));

  return (
    <div className={styles.shell} style={{ paddingBottom: keyboardOpen ? 0 : bottomHeight }}>
      <Outlet />
      <div
        ref={bottomRef}
        className={cx(styles.bottom, keyboardOpen && styles.hidden)}
        data-testid="shell-bottom"
      >
        <div className={styles.overlay}>
          <ShellOverlay />
        </div>
        <TabBar items={items} />
      </div>
    </div>
  );
}
