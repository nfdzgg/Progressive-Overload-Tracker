import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadFile,
  exportFileName,
  isAbortError,
  makeExportFile,
  readFileText,
  shareOrDownload,
} from './files';

describe('exportFileName', () => {
  it('names a full backup overload-backup-YYYY-MM-DD.json', () => {
    expect(exportFileName('backup', '2026-10-09')).toBe('overload-backup-2026-10-09.json');
  });

  it('names a logs export overload-logs-YYYY-MM-DD.csv', () => {
    expect(exportFileName('logs', '2026-10-09')).toBe('overload-logs-2026-10-09.csv');
  });

  it('names a routine export overload-routine-YYYY-MM-DD.json', () => {
    expect(exportFileName('routine', '2026-01-02')).toBe('overload-routine-2026-01-02.json');
  });
});

describe('makeExportFile', () => {
  it('builds a JSON file with the dated name', async () => {
    const file = makeExportFile('backup', '{"a":1}', '2026-10-09');
    expect(file.name).toBe('overload-backup-2026-10-09.json');
    expect(file.type).toBe('application/json');
    expect(await readFileText(file)).toBe('{"a":1}');
  });

  it('builds a CSV file for logs', () => {
    const file = makeExportFile('logs', 'date\n', '2026-10-09');
    expect(file.name).toBe('overload-logs-2026-10-09.csv');
    expect(file.type).toBe('text/csv');
  });
});

describe('isAbortError', () => {
  it('recognizes a cancelled share', () => {
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true);
  });

  it('does not treat other failures as cancellation', () => {
    expect(isAbortError(new DOMException('no', 'NotAllowedError'))).toBe(false);
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

// jsdom has no Web Share API and no object URLs; each test installs what it needs.
function setNavigator(key: 'share' | 'canShare', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

function clearNavigator() {
  for (const key of ['share', 'canShare'] as const) {
    if (Object.prototype.hasOwnProperty.call(navigator, key)) {
      delete (navigator as unknown as Record<string, unknown>)[key];
    }
  }
}

describe('shareOrDownload', () => {
  const file = () => makeExportFile('backup', '{}', '2026-10-09');
  let click: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let downloads: Array<{ href: string; download: string }>;

  beforeEach(() => {
    vi.useFakeTimers();
    downloads = [];
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
  });

  afterEach(() => {
    clearNavigator();
    vi.useRealTimers();
  });

  it('falls back to a download when the Web Share API is missing', async () => {
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('downloaded');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual([
      { href: 'blob:mock-url', download: 'overload-backup-2026-10-09.json' },
    ]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('revokes the object URL after a delay', async () => {
    await shareOrDownload(file(), 'Backup');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloads when the browser cannot share files of this type', async () => {
    const share = vi.fn();
    setNavigator('share', share);
    setNavigator(
      'canShare',
      vi.fn(() => false),
    );
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads when share exists but canShare does not', async () => {
    const share = vi.fn();
    setNavigator('share', share);
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
  });

  it('shares the file with a title when sharing files is supported', async () => {
    const f = file();
    const canShare = vi.fn(() => true);
    const share = vi.fn(async () => {});
    setNavigator('canShare', canShare);
    setNavigator('share', share);
    await expect(shareOrDownload(f, 'Overload backup')).resolves.toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [f] });
    expect(share).toHaveBeenCalledWith({ files: [f], title: 'Overload backup' });
    expect(click).not.toHaveBeenCalled();
  });

  it('reports a share the user cancelled, without downloading', async () => {
    setNavigator(
      'canShare',
      vi.fn(() => true),
    );
    setNavigator(
      'share',
      vi.fn(async () => {
        throw new DOMException('Share canceled', 'AbortError');
      }),
    );
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    setNavigator(
      'canShare',
      vi.fn(() => true),
    );
    setNavigator(
      'share',
      vi.fn(async () => {
        throw new DOMException('No user activation', 'NotAllowedError');
      }),
    );
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('falls back to a download when canShare throws', async () => {
    setNavigator(
      'canShare',
      vi.fn(() => {
        throw new TypeError('bad data');
      }),
    );
    setNavigator('share', vi.fn());
    await expect(shareOrDownload(file(), 'Backup')).resolves.toBe('downloaded');
  });

  it('downloadFile uses a temporary link with the file name', () => {
    downloadFile(makeExportFile('logs', 'x', '2026-10-09'));
    expect(downloads).toEqual([
      { href: 'blob:mock-url', download: 'overload-logs-2026-10-09.csv' },
    ]);
    expect(document.body.querySelector('a')).toBeNull();
  });
});

describe('readFileText', () => {
  it('reads a file as text', async () => {
    const file = new File(['{"hello":"wörld"}'], 'x.json', { type: 'application/json' });
    await expect(readFileText(file)).resolves.toBe('{"hello":"wörld"}');
  });
});
