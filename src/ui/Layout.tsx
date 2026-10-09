import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Layout.module.css';

export type Space = 'none' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const GAP: Record<Space, string> = {
  none: styles.gapNone,
  xxs: styles.gapXxs,
  xs: styles.gapXs,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
  xl: styles.gapXl,
  xxl: styles.gapXxl,
};

const ALIGN = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
  stretch: styles.alignStretch,
  baseline: styles.alignBaseline,
};

const JUSTIFY = {
  start: styles.justifyStart,
  center: styles.justifyCenter,
  end: styles.justifyEnd,
  between: styles.justifyBetween,
};

interface LayoutProps {
  gap?: Space;
  align?: keyof typeof ALIGN;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/** Vertical stack with a token gap. Cards stack with `sm`, sections with `xl`. */
export function Stack({
  gap = 'sm',
  align = 'stretch',
  as: C = 'div',
  className,
  children,
}: LayoutProps) {
  return <C className={cx(styles.stack, GAP[gap], ALIGN[align], className)}>{children}</C>;
}

interface InlineProps extends LayoutProps {
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
}

/** Horizontal row with a token gap. */
export function Inline({
  gap = 'xs',
  align = 'center',
  justify = 'start',
  wrap = false,
  as: C = 'div',
  className,
  children,
}: InlineProps) {
  return (
    <C
      className={cx(
        styles.inline,
        GAP[gap],
        ALIGN[align],
        JUSTIFY[justify],
        wrap && styles.wrap,
        className,
      )}
    >
      {children}
    </C>
  );
}

/** Takes the remaining space in an Inline row (and lets text truncate). */
export function Grow({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cx(styles.grow, className)}>{children}</div>;
}

/** Hides content visually while keeping it available to screen readers. */
export function VisuallyHidden({
  children,
  as: C = 'span',
}: {
  children: ReactNode;
  as?: ElementType;
}) {
  return <C className={styles.visuallyHidden}>{children}</C>;
}
