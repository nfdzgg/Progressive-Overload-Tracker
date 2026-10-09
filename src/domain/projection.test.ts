import { describe, expect, it } from 'vitest';
import { projectCycle } from './projection';
import { REST, W } from './test-helpers';
import type { CycleState } from './types';

const ITEMS = [W('push'), W('pull'), W('legs'), REST];

function state(overrides: Partial<CycleState> = {}): CycleState {
  return { items: ITEMS, pointer: 0, pointerSince: '2026-03-02', restartOn: null, ...overrides };
}

const labels = (days: ReturnType<typeof projectCycle>) =>
  days.map(
    (d) => `${d.date}:${d.item.kind === 'rest' ? (d.waiting ? 'wait' : 'rest') : d.item.workoutId}`,
  );

describe('projection (5.2)', () => {
  it('walks the cycle from the pointer, one item per day, starting today', () => {
    expect(labels(projectCycle(state({ pointer: 1 }), '2026-03-02', '2026-03-07'))).toEqual([
      '2026-03-02:pull',
      '2026-03-03:legs',
      '2026-03-04:rest',
      '2026-03-05:push',
      '2026-03-06:pull',
      '2026-03-07:legs',
    ]);
  });

  it("starts tomorrow when today's session is finished", () => {
    // Finishing set pointerSince to tomorrow.
    const s = state({ pointer: 1, pointerSince: '2026-03-03' });
    expect(labels(projectCycle(s, '2026-03-02', '2026-03-04'))).toEqual([
      '2026-03-03:pull',
      '2026-03-04:legs',
    ]);
  });

  it('consumes a rest item whose day has passed before projecting', () => {
    const s = state({ pointer: 3, pointerSince: '2026-03-01' });
    expect(labels(projectCycle(s, '2026-03-02', '2026-03-03'))).toEqual([
      '2026-03-02:push',
      '2026-03-03:pull',
    ]);
  });

  it('honors a scheduled restart: waiting days until restartOn, then item 0', () => {
    const s = state({ pointer: 2, restartOn: '2026-03-09' });
    expect(labels(projectCycle(s, '2026-03-06', '2026-03-10'))).toEqual([
      '2026-03-06:wait',
      '2026-03-07:wait',
      '2026-03-08:wait',
      '2026-03-09:push',
      '2026-03-10:pull',
    ]);
  });

  it('returns nothing for an empty cycle or an empty range', () => {
    expect(projectCycle(state({ items: [] }), '2026-03-02', '2026-03-09')).toEqual([]);
    expect(projectCycle(state(), '2026-03-02', '2026-03-01')).toEqual([]);
  });
});
