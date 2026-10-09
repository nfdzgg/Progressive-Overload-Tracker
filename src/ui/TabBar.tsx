import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import styles from './TabBar.module.css';

export interface TabItem {
  label: string;
  icon: IconName;
  /** Hash link, e.g. "#/today". */
  href: string;
  active: boolean;
}

/** Fixed bottom bar with four tabs; the active tab uses lavender. */
export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className={styles.bar} aria-label="Main">
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href} className={styles.item}>
            <a
              href={item.href}
              className={cx(styles.tab, item.active && styles.active)}
              aria-current={item.active ? 'page' : undefined}
            >
              <Icon name={item.icon} size="tab" />
              <span className={styles.label}>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
