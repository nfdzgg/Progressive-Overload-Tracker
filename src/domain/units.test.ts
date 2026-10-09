import { describe, expect, it } from 'vitest';
import { convertWeight, displayWeight, KG_TO_LB, roundToHalf, toLb } from './units';

describe('unit conversion (4.2)', () => {
  it('uses 1 kg = 2.2046 lb', () => {
    expect(KG_TO_LB).toBe(2.2046);
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.46, 6);
    expect(convertWeight(220.46, 'lb', 'kg')).toBeCloseTo(100, 6);
    expect(convertWeight(50, 'lb', 'lb')).toBe(50);
  });

  it('rounds converted display values to the nearest 0.5', () => {
    expect(roundToHalf(220.46)).toBe(220.5);
    expect(roundToHalf(22.24)).toBe(22);
    expect(roundToHalf(22.25)).toBe(22.5);
    expect(displayWeight(100, 'kg', 'lb')).toBe(220.5);
    expect(displayWeight(45, 'lb', 'kg')).toBe(20.5);
  });

  it('shows the number as typed when the display unit matches', () => {
    expect(displayWeight(62.25, 'kg', 'kg')).toBe(62.25);
    expect(displayWeight(101.3, 'lb', 'lb')).toBe(101.3);
  });

  it('normalizes to pounds for comparisons without rounding', () => {
    expect(toLb(100, 'kg')).toBeCloseTo(220.46, 6);
    expect(toLb(100, 'lb')).toBe(100);
  });
});
