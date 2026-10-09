import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from './overlay';
import { Text } from './Text';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Sheet title in subhead type. */
  title: string;
  children: ReactNode;
  /** Pinned below the content, e.g. the single confirming action. */
  footer?: ReactNode;
}

/**
 * Bottom sheet for notes, the "more" menu, calendar day details, and pickers.
 * Closes on scrim tap or Escape. Put `data-autofocus` on an element to focus
 * it when the sheet opens.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, panelRef, onClose);

  if (!open) return null;
  return createPortal(
    <div className={styles.root}>
      <div
        className={styles.scrim}
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-scrim"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
      >
        <div className={styles.handle} aria-hidden="true" />
        <Text as="h2" id={titleId} variant="subhead" className={styles.title}>
          {title}
        </Text>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
