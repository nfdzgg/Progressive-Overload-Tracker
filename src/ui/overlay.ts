import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open modals, oldest first; only the topmost handles Escape and Tab. */
const stack: symbol[] = [];

/**
 * Shared behavior for modal surfaces (sheets and dialogs): Escape closes,
 * focus moves inside and is trapped, focus returns on close, and the page
 * behind does not scroll. With stacked modals (a confirmation above a sheet)
 * only the topmost one responds.
 */
export function useModal(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const autofocus = panel?.querySelector<HTMLElement>('[data-autofocus]');
    (autofocus ?? panel)?.focus();

    const token = Symbol('modal');
    stack.push(token);
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}
