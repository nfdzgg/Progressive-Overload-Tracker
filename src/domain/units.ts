import type { Unit } from './types';

/** SPEC 4.2: 1 kg = 2.2046 lb. */
export const KG_TO_LB = 2.2046;

export const UNITS: Unit[] = ['lb', 'kg'];

/** Exact conversion (no rounding); use for comparisons and sums. */
export function convertWeight(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return from === 'kg' ? value * KG_TO_LB : value / KG_TO_LB;
}

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Display value: the number as typed when the unit matches, otherwise the
 * converted value rounded to the nearest 0.5. Stored values never change.
 */
export function displayWeight(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return roundToHalf(convertWeight(value, from, to));
}

/** Normalizes to pounds for comparing entries typed in different units. */
export function toLb(value: number, unit: Unit): number {
  return convertWeight(value, unit, 'lb');
}
