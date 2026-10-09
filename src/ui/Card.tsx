import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react';
import { cx } from './cx';
import { Text } from './Text';
import styles from './Card.module.css';

export type CardVariant = 'exercise' | 'exercise-done' | 'dashboard' | 'group';

export interface CardProps extends ComponentPropsWithRef<'div'> {
  /**
   * `exercise`: surface-1 card on Today. `exercise-done`: a logged card that
   * drops to canvas with subtle text. `dashboard`: a Progress stat or chart.
   * `group`: a Settings group (rows inside, no vertical padding).
   */
  variant?: CardVariant;
  as?: ElementType;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  exercise: styles.exercise,
  'exercise-done': styles.exerciseDone,
  dashboard: styles.dashboard,
  group: styles.group,
};

export function Card({ variant = 'exercise', as: C = 'div', className, ...rest }: CardProps) {
  return <C className={cx(styles.card, VARIANT_CLASS[variant], className)} {...rest} />;
}

export interface CardHeaderProps {
  /** Exercise name (body-lg at weight 500); long names wrap to two lines. */
  title: ReactNode;
  /** Icon actions at the right, e.g. notes and more. */
  actions?: ReactNode;
  /** Steps the title down to subtle ink (done state). */
  subdued?: boolean;
  titleId?: string;
}

export function CardHeader({ title, actions, subdued, titleId }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <Text
        as="h2"
        id={titleId}
        variant="body-lg"
        weight="medium"
        tone={subdued ? 'subtle' : 'ink'}
        className={styles.title}
      >
        {title}
      </Text>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export interface DashboardCardProps {
  /** Eyebrow label, e.g. "This week". */
  label: string;
  /** Key value in card-title type. */
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Progress stat or chart: eyebrow label, key value, then chart or list. */
export function DashboardCard({ label, value, children, className }: DashboardCardProps) {
  return (
    <Card variant="dashboard" as="section" className={cx(styles.dashboardStack, className)}>
      <Text as="h2" variant="eyebrow" tone="subtle">
        {label}
      </Text>
      {value !== undefined && (
        <Text as="p" variant="card-title">
          {value}
        </Text>
      )}
      {children}
    </Card>
  );
}
