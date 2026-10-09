import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useModal } from './overlay';
import { Text } from './Text';
import styles from './Dialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** States exactly what will happen, e.g. "This replaces everything on this device." */
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `destructive` for delete, restart, and overwriting imports. */
  tone?: 'primary' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation dialog; destructive actions are always followed by one. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();
  useModal(open, panelRef, onCancel);

  if (!open) return null;
  return createPortal(
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className={styles.panel}
      >
        <Text as="h2" id={titleId} variant="subhead">
          {title}
        </Text>
        <Text as="div" id={messageId} variant="body-sm" tone="muted">
          {message}
        </Text>
        <div className={styles.actions}>
          <Button variant="tertiary" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
