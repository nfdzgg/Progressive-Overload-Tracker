import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLoggedEntry,
  CSV_HEADER,
  completeFirstRun,
  createPastSession,
  exportBackupText,
  exportRoutineText,
  getSettings,
  parseBackup,
  readAllData,
  saveCycleItems,
  updateSettings,
  wipeAllData,
} from '../../data';
import { addDays, formatDate, todayISO } from '../../domain';
import { DataSection } from './DataSection';
import { readFileText } from './files';

const today = todayISO();
let saved: File[];

function setNavigator(key: 'share' | 'canShare', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

beforeEach(async () => {
  await wipeAllData();
  await completeFirstRun('template', 'lb', today);
  saved = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: (file: File) => {
      saved.push(file);
      return 'blob:test';
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => {},
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ['share', 'canShare'] as const) {
    if (Object.prototype.hasOwnProperty.call(navigator, key)) {
      delete (navigator as unknown as Record<string, unknown>)[key];
    }
  }
});

/** Logs one Chest press entry (2 sets) in a finished Push session on `date`. */
async function logOneEntry(date: string) {
  const data = await readAllData(today);
  const push = data.workouts.find((w) => w.name === 'Push')!;
  const press = data.exercises.find((e) => e.name === 'Chest press')!;
  const session = await createPastSession(date, push.id);
  await addLoggedEntry({
    sessionId: session.id,
    exerciseId: press.id,
    variantId: press.defaultVariantId,
    unit: 'lb',
    weight: 100,
    sets: [
      { reps: 10, weight: null },
      { reps: 9, weight: null },
    ],
  });
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const jsonFile = (text: string, name: string) =>
  new File([text], name, { type: 'application/json' });

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

/** Text of the error regions (one per group; empty when there is no error). */
const alertText = () =>
  screen
    .getAllByRole('alert')
    .map((el) => el.textContent)
    .join('');

const expectAlert = (text: string) => waitFor(() => expect(alertText()).toBe(text));

describe('DataSection: last export and reminder', () => {
  it('shows "Never" and no reminder before any export or logs', async () => {
    render(<DataSection />);
    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument();
    expect(await screen.findByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Last export')).toBeInTheDocument();
    expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument();
  });

  it('never exported with logged data shows the reminder', async () => {
    await logOneEntry(addDays(today, -1));
    render(<DataSection />);
    expect(await screen.findByText('Time for a backup')).toBeInTheDocument();
    expect(screen.getByText(/never been exported/)).toBeInTheDocument();
  });

  it('shows the last export date and no reminder within 14 days', async () => {
    await logOneEntry(addDays(today, -1));
    await updateSettings({ lastExportAt: daysAgo(14) });
    render(<DataSection />);
    expect(await screen.findByText(formatDate(addDays(today, -14)))).toBeInTheDocument();
    expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument();
  });

  it('shows the reminder when the last export is more than 14 days old', async () => {
    await updateSettings({ lastExportAt: daysAgo(20) });
    render(<DataSection />);
    expect(await screen.findByText('Time for a backup')).toBeInTheDocument();
    expect(screen.getByText(/Last export was 20 days ago/)).toBeInTheDocument();
    expect(screen.getByText(formatDate(addDays(today, -20)))).toBeInTheDocument();
  });
});

describe('DataSection: exports', () => {
  it('exports a full backup as a download and records the export', async () => {
    await logOneEntry(addDays(today, -1));
    const user = userEvent.setup();
    render(<DataSection />);
    await screen.findByText('Time for a backup');
    await user.click(row('Export full backup'));
    expect(await screen.findByText('Backup exported.')).toBeInTheDocument();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe(`overload-backup-${today}.json`);
    const data = parseBackup(await readFileText(saved[0]));
    expect(data.exercises).toHaveLength(16);
    expect(data.entries).toHaveLength(1);
    expect((await getSettings()).lastExportAt).not.toBeNull();
    expect(await screen.findByText(formatDate(today))).toBeInTheDocument();
    expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument();
  });

  it('shares the backup when the browser can share files, and records the export', async () => {
    const share = vi.fn(async () => {});
    setNavigator('canShare', () => true);
    setNavigator('share', share);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.click(row('Export full backup'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files, title }] = share.mock.calls[0] as unknown as [{ files: File[]; title: string }];
    expect(files[0].name).toBe(`overload-backup-${today}.json`);
    expect(title).toBe('Overload backup');
    expect(saved).toHaveLength(0);
    await waitFor(async () => expect((await getSettings()).lastExportAt).not.toBeNull());
  });

  it('a cancelled share is not an error and does not count as exported', async () => {
    setNavigator('canShare', () => true);
    const share = vi.fn(async () => {
      throw new DOMException('Share canceled', 'AbortError');
    });
    setNavigator('share', share);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.click(row('Export full backup'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(alertText()).toBe('');
    expect(screen.queryByText('Backup exported.')).not.toBeInTheDocument();
    expect((await getSettings()).lastExportAt).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('exports logs as CSV with one row per logged set; not counted as a backup', async () => {
    await logOneEntry(addDays(today, -1));
    const user = userEvent.setup();
    render(<DataSection />);
    await user.click(row('Export logs'));
    expect(await screen.findByText('Logs exported.')).toBeInTheDocument();
    expect(saved[0].name).toBe(`overload-logs-${today}.csv`);
    const lines = (await readFileText(saved[0])).trim().split('\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines).toHaveLength(3);
    expect((await getSettings()).lastExportAt).toBeNull();
  });

  it('exports the routine only, with no logs; not counted as a backup', async () => {
    await logOneEntry(addDays(today, -1));
    const user = userEvent.setup();
    render(<DataSection />);
    await user.click(row('Export routine only'));
    expect(await screen.findByText('Routine exported.')).toBeInTheDocument();
    expect(saved[0].name).toBe(`overload-routine-${today}.json`);
    const file = JSON.parse(await readFileText(saved[0]));
    expect(file.kind).toBe('routine');
    expect(file.data).not.toHaveProperty('sessions');
    expect(file.data).not.toHaveProperty('entries');
    expect(file.data.exercises).toHaveLength(16);
    expect((await getSettings()).lastExportAt).toBeNull();
  });
});

describe('DataSection: import backup', () => {
  it('the Import backup row opens the file picker', async () => {
    const user = userEvent.setup();
    render(<DataSection />);
    const input = screen.getByTestId('backup-file-input');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/json,.json');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    await user.click(row('Import backup'));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation, then replaces everything with the file', async () => {
    await logOneEntry(addDays(today, -1));
    await updateSettings({ restTimerSound: false });
    const before = await readAllData(today);
    const text = await exportBackupText(today);
    await wipeAllData();
    await completeFirstRun('blank', 'kg', today);

    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(
      screen.getByTestId('backup-file-input'),
      jsonFile(text, 'overload-backup-2026-10-01.json'),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'Replace everything?' });
    expect(dialog).toHaveTextContent(/replaces everything on this device/);
    expect(dialog).toHaveTextContent('overload-backup-2026-10-01.json');
    expect((await readAllData(today)).exercises).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }));
    expect(await screen.findByText(/Backup imported/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await readAllData(today)).toEqual(before);
  });

  it('cancelling the confirmation changes nothing', async () => {
    const text = await exportBackupText(today);
    await wipeAllData();
    await completeFirstRun('blank', 'lb', today);
    const before = await readAllData(today);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByTestId('backup-file-input'), jsonFile(text, 'backup.json'));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await readAllData(today)).toEqual(before);
  });

  it('an invalid file shows a readable error and changes nothing', async () => {
    const before = await readAllData(today);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByTestId('backup-file-input'), jsonFile('not json', 'broken.json'));
    await expectAlert('This file is not valid JSON.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await readAllData(today)).toEqual(before);
  });

  it('a routine file picked for Import backup is rejected', async () => {
    const routine = await exportRoutineText(today);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByTestId('backup-file-input'), jsonFile(routine, 'r.json'));
    await expectAlert('This is a routine file, not a full backup. Use "Import routine" instead.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('DataSection: import routine', () => {
  it('confirms, keeps history, replaces cycle and workouts, and reports the counts', async () => {
    await logOneEntry(addDays(today, -1));
    const file = JSON.parse(await exportRoutineText(today));
    const renamed = file.data.exercises.findIndex(
      (e: { name: string }) => e.name === 'Hammer curl',
    );
    file.data.exercises[renamed].name = 'Cable curl';
    // The device's cycle changed since the export; the import replaces it.
    await saveCycleItems([{ kind: 'rest' }], today);
    const before = await readAllData(today);

    const user = userEvent.setup();
    render(<DataSection />);
    const input = screen.getByTestId('routine-file-input');
    expect(input).toHaveAttribute('accept', 'application/json,.json');
    await user.upload(input, jsonFile(JSON.stringify(file), 'overload-routine-2026-10-01.json'));
    const dialog = await screen.findByRole('alertdialog', { name: 'Import routine?' });
    expect(dialog).toHaveTextContent(/matched to your exercises by name/);
    expect(dialog).toHaveTextContent(/history is kept/);
    expect(dialog).toHaveTextContent(/created/);
    expect(dialog).toHaveTextContent(/cycle and workouts are replaced/);
    await user.click(within(dialog).getByRole('button', { name: 'Import routine' }));

    expect(
      await screen.findByText(
        'Routine imported: 15 exercises matched by name (history kept), 1 created.',
      ),
    ).toBeInTheDocument();
    const after = await readAllData(today);
    expect(after.entries).toEqual(before.entries);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.exercises).toHaveLength(17);
    expect(after.workouts).toHaveLength(3);
    expect(after.cycle.items).toHaveLength(7);
    expect(after.cycle.pointer).toBe(0);
  });

  it('a full backup picked for Import routine is rejected', async () => {
    const backup = await exportBackupText(today);
    const user = userEvent.setup();
    render(<DataSection />);
    await user.upload(screen.getByTestId('routine-file-input'), jsonFile(backup, 'b.json'));
    await expectAlert('This is a full backup, not a routine file. Use "Import backup" instead.');
    // Shown under the routine group, the one that was used.
    const routineGroup = screen.getByRole('list', { name: 'Routine' }).parentElement!
      .parentElement!;
    expect(within(routineGroup).getByRole('alert')).toHaveTextContent('This is a full backup');
  });
});
