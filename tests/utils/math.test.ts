import { describe, expect, it } from 'vitest';
import {
  clamp,
  lerp,
  nearlyEqual,
  niceDomain,
  normalize,
  precisionFor,
  roundTo,
  tickStep,
  ticks,
} from '@/utils/math.ts';

describe('clamp and lerp', () => {
  it('clamps to the closed interval', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('interpolates linearly and extrapolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(0, 10, 2)).toBe(20);
  });

  it('normalizes into unit space', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(5, 5, 5)).toBe(0.5);
  });
});

describe('nearlyEqual', () => {
  it('tolerates floating point drift', () => {
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(nearlyEqual(1, 1.1)).toBe(false);
  });
});

describe('ticks', () => {
  it('produces human-readable steps', () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('avoids floating point drift on fractional steps', () => {
    expect(ticks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('stays inside the domain', () => {
    const result = ticks(1.3, 9.7, 5);
    expect(result[0]).toBeGreaterThanOrEqual(1.3);
    expect(result.at(-1)).toBeLessThanOrEqual(9.7);
  });

  it('handles reversed domains', () => {
    expect(ticks(10, 0, 5)).toEqual([10, 8, 6, 4, 2, 0]);
  });

  it('handles degenerate input', () => {
    expect(ticks(5, 5, 10)).toEqual([5]);
    expect(ticks(0, 10, 0)).toEqual([]);
  });

  it('approximates the requested count', () => {
    for (const count of [3, 5, 10]) {
      const result = ticks(0, 97, count);
      expect(result.length).toBeGreaterThanOrEqual(Math.floor(count / 2));
      expect(result.length).toBeLessThanOrEqual(count * 2 + 1);
    }
  });
});

describe('tickStep', () => {
  it('returns positive steps', () => {
    expect(tickStep(0, 100, 10)).toBe(10);
    expect(tickStep(0, 1, 10)).toBeCloseTo(0.1);
  });
});

describe('niceDomain', () => {
  it('rounds the domain outward', () => {
    expect(niceDomain(0.3, 9.4, 5)).toEqual([0, 10]);
    expect(niceDomain(1, 99, 5)).toEqual([0, 100]);
  });

  it('preserves reversed order', () => {
    expect(niceDomain(9.4, 0.3, 5)).toEqual([10, 0]);
  });

  it('leaves degenerate domains alone', () => {
    expect(niceDomain(5, 5, 5)).toEqual([5, 5]);
  });
});

describe('numeric helpers', () => {
  it('rounds to decimals', () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(roundTo(1.005, 2)).toBeCloseTo(1.0, 5);
  });

  it('derives display precision from a step', () => {
    expect(precisionFor(1)).toBe(0);
    expect(precisionFor(0.1)).toBe(1);
    expect(precisionFor(0.001)).toBe(3);
  });
});
