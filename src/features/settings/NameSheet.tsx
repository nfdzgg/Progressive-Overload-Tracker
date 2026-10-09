import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button, Sheet, Stack, TextInput } from '../../ui';

export interface NameSheetProps {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  initialValue?: string;
  placeholder?: string;
  /** Returns an error message, or undefined when the name is fine. */
  validate: (name: string) => string | undefined;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
  /** Extra content below the field (e.g. more actions). */
  children?: ReactNode;
}

/** Bottom sheet with one name field and one confirming action (create, add, rename). */
export function NameSheet({ open, ...rest }: NameSheetProps) {
  // Mounted only while open, so every opening starts from `initialValue`.
  return open ? <NameSheetBody {...rest} /> : null;
}

function NameSheetBody({
  title,
  label,
  confirmLabel,
  initialValue = '',
  placeholder,
  validate,
  onSubmit,
  onClose,
  children,
}: Omit<NameSheetProps, 'open'>) {
  const [value, setValue] = useState(initialValue);
  const [tried, setTried] = useState(false);
  const error = validate(value);
  // An empty field only complains after a try; other problems show while typing.
  const shownError = tried || value.trim() !== '' ? error : undefined;

  function submit() {
    setTried(true);
    if (error) return;
    void onSubmit(value.trim());
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" fullWidth onClick={submit}>
          {confirmLabel}
        </Button>
      }
    >
      <Stack gap="lg">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextInput
            label={label}
            value={value}
            placeholder={placeholder}
            error={shownError}
            autoComplete="off"
            enterKeyHint="done"
            onValueChange={setValue}
            data-autofocus
          />
        </form>
        {children}
      </Stack>
    </Sheet>
  );
}
