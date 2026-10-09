import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Text.module.css';

export type TypeVariant =
  | 'display-md'
  | 'headline'
  | 'card-title'
  | 'subhead'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'button'
  | 'eyebrow'
  | 'mono';

export type TextTone = 'ink' | 'muted' | 'subtle' | 'tertiary' | 'success' | 'danger' | 'inherit';

export interface TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  as?: ElementType;
  /** Clamp to one line with an ellipsis. */
  truncate?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
}

const VARIANT_CLASS: Record<TypeVariant, string> = {
  'display-md': styles.displayMd,
  headline: styles.headline,
  'card-title': styles.cardTitle,
  subhead: styles.subhead,
  'body-lg': styles.bodyLg,
  body: styles.body,
  'body-sm': styles.bodySm,
  caption: styles.caption,
  button: styles.button,
  eyebrow: styles.eyebrow,
  mono: styles.mono,
};

const TONE_CLASS: Record<TextTone, string | undefined> = {
  ink: styles.ink,
  muted: styles.muted,
  subtle: styles.subtle,
  tertiary: styles.tertiary,
  success: styles.success,
  danger: styles.danger,
  inherit: undefined,
};

/** Typography from DESIGN.md: one family, hierarchy from size, weight, and ink level. */
export function Text({
  variant = 'body',
  tone = 'ink',
  weight,
  as: Component = 'span',
  truncate,
  className,
  id,
  children,
}: TextProps) {
  return (
    <Component
      id={id}
      className={cx(
        VARIANT_CLASS[variant],
        TONE_CLASS[tone],
        weight && styles[weight],
        truncate && styles.truncate,
        className,
      )}
    >
      {children}
    </Component>
  );
}
