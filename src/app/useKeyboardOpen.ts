import { useEffect, useState } from 'react';

const TEXT_INPUT = 'input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea';

/**
 * True while the on-screen keyboard is open: a text field has focus and the
 * visual viewport has shrunk well below its tallest size (iOS and Android).
 * Desktop and emulated browsers never shrink, so they never hide the tab bar.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let tallest = viewport.height;
    const update = () => {
      tallest = Math.max(tallest, viewport.height);
      const focused = document.activeElement?.matches?.(TEXT_INPUT) ?? false;
      setOpen(focused && viewport.height < tallest * 0.75);
    };
    const onOrientation = () => {
      tallest = viewport.height;
      update();
    };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return open;
}
