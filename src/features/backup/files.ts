// Export files: naming, and handing a file to the user through the Web Share
// API when the browser can share it, otherwise as a download.
import type { ISODate } from '../../domain';

export type ExportKind = 'backup' | 'logs' | 'routine';

const EXTENSION: Record<ExportKind, string> = { backup: 'json', logs: 'csv', routine: 'json' };
const MIME_TYPE: Record<ExportKind, string> = {
  backup: 'application/json',
  logs: 'text/csv',
  routine: 'application/json',
};

/** Title passed to the share sheet. */
export const SHARE_TITLE: Record<ExportKind, string> = {
  backup: 'Overload backup',
  logs: 'Overload logs',
  routine: 'Overload routine',
};

/** `overload-backup-YYYY-MM-DD.json`, `overload-logs-YYYY-MM-DD.csv`, `overload-routine-YYYY-MM-DD.json`. */
export function exportFileName(kind: ExportKind, today: ISODate): string {
  return `overload-${kind}-${today}.${EXTENSION[kind]}`;
}

export function makeExportFile(kind: ExportKind, text: string, today: ISODate): File {
  return new File([text], exportFileName(kind, today), { type: MIME_TYPE[kind] });
}

/** A share sheet the user dismissed; not an error. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** How long a download's object URL is kept before it is released. */
const REVOKE_DELAY_MS = 60_000;

/** Saves a file through a temporary `<a download>` link. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Shares the file when the browser can share files of its type (the share
 * sheet on phones), otherwise downloads it. A dismissed share sheet returns
 * 'cancelled'; any other share failure (for example an expired user gesture)
 * falls back to a download.
 */
export async function shareOrDownload(file: File, title: string): Promise<DeliveryResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }
  downloadFile(file);
  return 'downloaded';
}

/** A picked file's text (FileReader fallback for engines without Blob.text). */
export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}
