// The quiet "time for a backup" row in Settings → Data (never shown on Today).
import { daysBetween, isISODate, toISODate, type ISODate } from '../../domain';

/** The reminder appears once the last export is more than this many days old. */
export const EXPORT_REMINDER_DAYS = 14;

/**
 * Local calendar date of the last export. `settings.lastExportAt` is a
 * timestamp (see markExported); a plain YYYY-MM-DD is accepted as-is.
 * Unreadable values count as never exported.
 */
export function exportDate(lastExportAt: string | null): ISODate | null {
  if (!lastExportAt) return null;
  if (isISODate(lastExportAt)) return lastExportAt;
  const time = Date.parse(lastExportAt);
  return Number.isNaN(time) ? null : toISODate(new Date(time));
}

/** Whole calendar days from the last export to today; null when never exported. */
export function daysSinceExport(lastExportAt: string | null, today: ISODate): number | null {
  const date = exportDate(lastExportAt);
  return date === null ? null : daysBetween(date, today);
}

/**
 * Due when the last export is more than 14 days old. Never exported: due only
 * once there is logged data worth backing up.
 */
export function isExportReminderDue(
  lastExportAt: string | null,
  today: ISODate,
  hasLoggedData: boolean,
): boolean {
  const days = daysSinceExport(lastExportAt, today);
  if (days === null) return hasLoggedData;
  return days > EXPORT_REMINDER_DAYS;
}

/** Detail line of the reminder row. */
export function reminderDetail(lastExportAt: string | null, today: ISODate): string {
  const days = daysSinceExport(lastExportAt, today);
  if (days === null) {
    return 'Your logs have never been exported. Export a full backup to keep them safe.';
  }
  return `Last export was ${days} days ago. Export a full backup to keep your logs safe.`;
}
