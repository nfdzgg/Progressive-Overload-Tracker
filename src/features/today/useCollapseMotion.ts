import { useLayoutEffect, useRef, type RefObject } from 'react';

/** A CSS time ("180ms", or ".18s" after minification) in milliseconds; 0 if unreadable. */
export function parseDurationMs(value: string): number {
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}

/**
 * Animates a card's height when it collapses to its done state (or reopens).
 * Duration and easing come from the motion tokens, so reduced motion (which
 * zeroes `--motion-duration`) turns it off.
 */
export function useCollapseMotion(ref: RefObject<HTMLElement | null>, collapsed: boolean): void {
  const lastHeight = useRef<number | null>(null);
  const lastCollapsed = useRef(collapsed);

  // Runs after every render so the previous height is always current.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.getBoundingClientRect().height;
    const before = lastHeight.current;
    lastHeight.current = height;
    if (lastCollapsed.current === collapsed) return;
    lastCollapsed.current = collapsed;
    if (before === null || before === height || typeof el.animate !== 'function') return;
    const style = getComputedStyle(el);
    const duration = parseDurationMs(style.getPropertyValue('--motion-duration'));
    if (duration <= 0) return;
    const easing = style.getPropertyValue('--motion-ease').trim() || 'ease-out';
    el.animate(
      [
        { height: `${before}px`, overflow: 'hidden' },
        { height: `${height}px`, overflow: 'hidden' },
      ],
      { duration, easing },
    );
  });
}
