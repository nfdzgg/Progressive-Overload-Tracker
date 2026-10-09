import { describe, expect, it } from 'vitest';
import {
  daysSinceExport,
  EXPORT_REMINDER_DAYS,
  exportDate,
  isExportReminderDue,
  reminderDetail,
} from './reminder';

// A local timestamp, as markExported() stores it (toISOString of a local time).
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('exportDate', () => {
  it('is null when nothing was ever exported', () => {
    expect(exportDate(null)).toBeNull();
  });

  it('turns a stored timestamp into the local calendar date', () => {
    expect(exportDate(at(2026, 9, 20))).toBe('2026-09-20');
    expect(exportDate(at(2026, 9, 20, 0))).toBe('2026-09-20');
    expect(exportDate(at(2026, 9, 20, 23))).toBe('2026-09-20');
  });

  it('accepts a plain calendar date as-is', () => {
    expect(exportDate('2026-09-20')).toBe('2026-09-20');
  });

  it('treats an unreadable value as never exported', () => {
    expect(exportDate('not a date')).toBeNull();
    expect(exportDate('')).toBeNull();
  });
});

describe('daysSinceExport', () => {
  it('counts whole calendar days since the export', () => {
    expect(daysSinceExport(at(2026, 10, 9), '2026-10-09')).toBe(0);
    expect(daysSinceExport(at(2026, 10, 8, 23), '2026-10-09')).toBe(1);
    expect(daysSinceExport(at(2026, 9, 25), '2026-10-09')).toBe(14);
  });

  it('is null when never exported', () => {
    expect(daysSinceExport(null, '2026-10-09')).toBeNull();
  });
});

describe('isExportReminderDue', () => {
  it('uses a 14-day threshold', () => {
    expect(EXPORT_REMINDER_DAYS).toBe(14);
  });

  it('is not due at exactly 14 days', () => {
    expect(isExportReminderDue(at(2026, 9, 25), '2026-10-09', true)).toBe(false);
  });

  it('is due when the last export is more than 14 days old', () => {
    expect(isExportReminderDue(at(2026, 9, 24), '2026-10-09', true)).toBe(true);
    expect(isExportReminderDue('2026-08-01', '2026-10-09', true)).toBe(true);
  });

  it('is due after 14 days even with no logged data (the date is what matters)', () => {
    expect(isExportReminderDue(at(2026, 9, 1), '2026-10-09', false)).toBe(true);
  });

  it('is not due for a recent export', () => {
    expect(isExportReminderDue(at(2026, 10, 8), '2026-10-09', true)).toBe(false);
  });

  it('never exported: due only once there is logged data', () => {
    expect(isExportReminderDue(null, '2026-10-09', false)).toBe(false);
    expect(isExportReminderDue(null, '2026-10-09', true)).toBe(true);
  });

  it('is not due when the export date is in the future (clock change)', () => {
    expect(isExportReminderDue(at(2026, 12, 1), '2026-10-09', true)).toBe(false);
  });
});

describe('reminderDetail', () => {
  it('says how long ago the last export was', () => {
    expect(reminderDetail(at(2026, 9, 1), '2026-10-09')).toBe(
      'Last export was 38 days ago. Export a full backup to keep your logs safe.',
    );
  });

  it('says when nothing has been exported yet', () => {
    expect(reminderDetail(null, '2026-10-09')).toBe(
      'Your logs have never been exported. Export a full backup to keep them safe.',
    );
  });
});
