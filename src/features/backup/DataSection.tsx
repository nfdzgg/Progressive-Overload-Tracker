// SPEC 6.6 Data: export and import of the full backup and the routine, CSV of
// the logs, the last export date, and a quiet reminder row (here only).
import type { ChangeEvent } from 'react';
import { useId, useRef, useState } from 'react';
import {
  BackupError,
  exportBackupText,
  exportLogsCsv,
  exportRoutineText,
  importBackupText,
  importRoutineText,
  markExported,
  parseBackup,
  parseRoutine,
  useSettings,
  useToday,
} from '../../data';
import { formatDate } from '../../domain';
import {
  Card,
  ConfirmDialog,
  ListGroup,
  ListItem,
  ListRow,
  SectionLabel,
  Stack,
  Text,
  VisuallyHidden,
} from '../../ui';
import {
  makeExportFile,
  readFileText,
  SHARE_TITLE,
  shareOrDownload,
  type ExportKind,
} from './files';
import { exportDate, isExportReminderDue, reminderDetail } from './reminder';
import { routineImportSummary } from './summary';
import { useHasLoggedData } from './useHasLoggedData';
import styles from './DataSection.module.css';

type Group = 'backup' | 'routine';
type ImportKind = Group;

interface Notice {
  group: Group;
  tone: 'status' | 'error';
  text: string;
}

interface PendingImport {
  kind: ImportKind;
  text: string;
  fileName: string;
}

const JSON_ACCEPT = 'application/json,.json';

const EXPORTED: Record<ExportKind, string> = {
  backup: 'Backup exported.',
  logs: 'Logs exported.',
  routine: 'Routine exported.',
};

const EXPORT_TEXT: Record<ExportKind, (today: string) => Promise<string>> = {
  backup: (today) => exportBackupText(today),
  logs: (today) => exportLogsCsv(today),
  routine: (today) => exportRoutineText(today),
};

/** Result line under a group: a status message, or an error in the invalid-field caption style. */
function NoticeLine({ notice, group }: { notice: Notice | null; group: Group }) {
  const mine = notice?.group === group ? notice : null;
  return (
    <>
      <div role="status" className={styles.notice}>
        {mine?.tone === 'status' && (
          <Text as="p" variant="body-sm" tone="muted">
            {mine.text}
          </Text>
        )}
      </div>
      <div role="alert" className={styles.notice}>
        {mine?.tone === 'error' && (
          <Text as="p" variant="caption" tone="danger">
            {mine.text}
          </Text>
        )}
      </div>
    </>
  );
}

export function DataSection() {
  const settings = useSettings();
  const hasLoggedData = useHasLoggedData();
  const today = useToday();
  const labelId = useId();
  const backupInput = useRef<HTMLInputElement>(null);
  const routineInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);

  const lastExportAt = settings?.lastExportAt ?? null;
  const lastExport = exportDate(lastExportAt);
  const reminderDue =
    settings !== undefined &&
    hasLoggedData !== undefined &&
    isExportReminderDue(lastExportAt, today, hasLoggedData);

  /** Runs one action at a time; a returned message is shown under the group. */
  async function run(group: Group, fallbackError: string, task: () => Promise<string | null>) {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    try {
      const message = await task();
      if (message) setNotice({ group, tone: 'status', text: message });
    } catch (error) {
      const text = error instanceof BackupError ? error.message : fallbackError;
      setNotice({ group, tone: 'error', text });
    } finally {
      busy.current = false;
    }
  }

  function exportFile(kind: ExportKind) {
    const group: Group = kind === 'routine' ? 'routine' : 'backup';
    void run(group, 'Export failed. Try again.', async () => {
      const text = await EXPORT_TEXT[kind](today);
      const result = await shareOrDownload(makeExportFile(kind, text, today), SHARE_TITLE[kind]);
      if (result === 'cancelled') return null;
      // Only the full backup can restore this device, so only it resets the reminder.
      if (kind === 'backup') await markExported();
      return EXPORTED[kind];
    });
  }

  function onFilePicked(kind: ImportKind, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Reset so picking the same file again fires another change.
    input.value = '';
    if (!file) return;
    void run(kind, 'Could not read this file. Nothing was changed.', async () => {
      const text = await readFileText(file);
      // Validate before asking, so an unusable file never reaches the confirmation.
      if (kind === 'backup') parseBackup(text);
      else parseRoutine(text);
      setPending({ kind, text, fileName: file.name });
      return null;
    });
  }

  function confirmImport() {
    if (!pending) return;
    const { kind, text } = pending;
    setPending(null);
    void run(kind, 'Import failed. Nothing was changed.', async () => {
      if (kind === 'backup') {
        await importBackupText(text);
        return 'Backup imported. This device now matches the file.';
      }
      const merge = await importRoutineText(text, today);
      return routineImportSummary(merge.matched, merge.created);
    });
  }

  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>Data</SectionLabel>
      <Stack gap="sm">
        <div>
          <Card variant="group">
            <ListGroup label="Backup">
              <ListItem>
                <ListRow
                  title="Last export"
                  trailing={settings ? (lastExport ? formatDate(lastExport) : 'Never') : undefined}
                />
              </ListItem>
              {reminderDue && (
                <ListItem>
                  <ListRow title="Time for a backup" detail={reminderDetail(lastExportAt, today)} />
                </ListItem>
              )}
              <ListItem>
                <ListRow
                  title="Export full backup"
                  detail="JSON with everything on this device"
                  onClick={() => exportFile('backup')}
                />
              </ListItem>
              <ListItem>
                <ListRow
                  title="Export logs"
                  detail="CSV, one row per logged set"
                  onClick={() => exportFile('logs')}
                />
              </ListItem>
              <ListItem>
                <ListRow
                  title="Import backup"
                  detail="Replaces everything on this device"
                  onClick={() => backupInput.current?.click()}
                />
              </ListItem>
            </ListGroup>
          </Card>
          <NoticeLine notice={notice} group="backup" />
        </div>
        <div>
          <Card variant="group">
            <ListGroup label="Routine">
              <ListItem>
                <ListRow
                  title="Export routine only"
                  detail="JSON without logs"
                  onClick={() => exportFile('routine')}
                />
              </ListItem>
              <ListItem>
                <ListRow
                  title="Import routine"
                  detail="Matches exercises by name, keeping history"
                  onClick={() => routineInput.current?.click()}
                />
              </ListItem>
            </ListGroup>
          </Card>
          <NoticeLine notice={notice} group="routine" />
        </div>
      </Stack>

      <VisuallyHidden>
        <input
          ref={backupInput}
          type="file"
          accept={JSON_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          data-testid="backup-file-input"
          onChange={(event) => onFilePicked('backup', event)}
        />
        <input
          ref={routineInput}
          type="file"
          accept={JSON_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          data-testid="routine-file-input"
          onChange={(event) => onFilePicked('routine', event)}
        />
      </VisuallyHidden>

      <ConfirmDialog
        open={pending?.kind === 'backup'}
        title="Replace everything?"
        message={`Importing ${pending?.fileName ?? 'this file'} replaces everything on this device: exercises, workouts, cycle, logs, and settings. This cannot be undone.`}
        confirmLabel="Replace everything"
        tone="destructive"
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'routine'}
        title="Import routine?"
        message="Exercises in the file are matched to your exercises by name, so their history is kept; new ones are created. Your cycle and workouts are replaced, and the cycle starts from its first item today."
        confirmLabel="Import routine"
        tone="destructive"
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
