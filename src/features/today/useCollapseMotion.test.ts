import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './useCollapseMotion';

describe('motion token durations', () => {
  it('reads milliseconds and seconds (the build minifies 180ms to .18s)', () => {
    expect(parseDurationMs('180ms')).toBe(180);
    expect(parseDurationMs(' .18s')).toBe(180);
    expect(parseDurationMs('0.2s')).toBe(200);
    expect(parseDurationMs('0ms')).toBe(0);
    expect(parseDurationMs('0s')).toBe(0);
  });

  it('anything unreadable means no motion', () => {
    expect(parseDurationMs('')).toBe(0);
    expect(parseDurationMs('fast')).toBe(0);
  });
});
