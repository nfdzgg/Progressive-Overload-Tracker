import { describe, expect, it } from 'vitest';
import { routineImportSummary } from './summary';

describe('routineImportSummary', () => {
  it('reports matched and created exercises', () => {
    expect(routineImportSummary(14, 2)).toBe(
      'Routine imported: 14 exercises matched by name (history kept), 2 created.',
    );
  });

  it('uses the singular for one exercise', () => {
    expect(routineImportSummary(1, 1)).toBe(
      'Routine imported: 1 exercise matched by name (history kept), 1 created.',
    );
  });

  it('leaves out a zero count', () => {
    expect(routineImportSummary(16, 0)).toBe(
      'Routine imported: 16 exercises matched by name (history kept).',
    );
    expect(routineImportSummary(0, 3)).toBe('Routine imported: 3 exercises created.');
  });

  it('handles a routine with no exercises', () => {
    expect(routineImportSummary(0, 0)).toBe('Routine imported: no exercises.');
  });
});
