import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders a labelled modal dialog and closes on Escape and scrim', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Notes" onClose={onClose} footer={<Button variant="primary">Save</Button>}>
        <p>Seat 4</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('Seat 4')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} title="Notes" onClose={() => {}}>
        x
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirms or cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Import backup?"
        message="This replaces everything on this device."
        confirmLabel="Replace"
        tone="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Import backup?' });
    expect(dialog).toHaveAccessibleDescription('This replaces everything on this device.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('stacked overlays', () => {
  it('Escape closes only the topmost overlay (a confirm dialog opened above a sheet)', async () => {
    const onSheetClose = vi.fn();
    const onCancel = vi.fn();
    const ui = (dialogOpen: boolean) => (
      <Sheet open title="Day" onClose={onSheetClose}>
        <p>entries</p>
        <ConfirmDialog
          open={dialogOpen}
          title="Delete entry?"
          message="This cannot be undone."
          confirmLabel="Delete"
          tone="destructive"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      </Sheet>
    );
    const { rerender } = render(ui(false));
    rerender(ui(true));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSheetClose).not.toHaveBeenCalled();
    // With the dialog closed, Escape reaches the sheet again.
    rerender(ui(false));
    await userEvent.keyboard('{Escape}');
    expect(onSheetClose).toHaveBeenCalledOnce();
  });
});
