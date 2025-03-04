import { describe, expect, it } from 'vitest';
import { scalePow, scaleSqrt } from '@/scales/pow.ts';

describe('scalePow', () => {
  it('applies the exponent', () => {
    const scale = scalePow({ domain: [0, 4], range: [0, 100], exponent: 2 });
    expect(scale(2)).toBe(25);
  });

  it('preserves sign for negative values', () => {
    const scale = scalePow({ domain: [-4, 4], range: [0, 100], exponent: 2 });
    expect(scale(0)).toBe(50);
    expect(scale(-4)).toBe(0);
  });

  it('provides a sqrt shorthand suited to area encoding', () => {
    const scale = scaleSqrt({ domain: [0, 100], range: [0, 10] });
    expect(scale(25)).toBe(5);
    expect(scale(100)).toBe(10);
  });

  it('inverts through the exponent', () => {
    const scale = scaleSqrt({ domain: [0, 100], range: [0, 10] });
    expect(scale.invert(5)).toBeCloseTo(25, 6);
  });
});
