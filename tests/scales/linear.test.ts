import { describe, expect, it } from 'vitest';
import { scaleLinear } from '@/scales/linear.ts';
import { interpolateRound } from '@/interpolate/basis.ts';

describe('scaleLinear', () => {
  it('maps a domain onto a range', () => {
    const scale = scaleLinear({ domain: [0, 100], range: [0, 500] });
    expect(scale(0)).toBe(0);
    expect(scale(50)).toBe(250);
    expect(scale(100)).toBe(500);
  });

  it('extrapolates beyond the domain by default', () => {
    const scale = scaleLinear({ domain: [0, 10], range: [0, 100] });
    expect(scale(20)).toBe(200);
    expect(scale(-5)).toBe(-50);
  });

  it('clamps when enabled', () => {
    const scale = scaleLinear({ domain: [0, 10], range: [0, 100], clamp: true });
    expect(scale(20)).toBe(100);
    expect(scale(-5)).toBe(0);
  });

  it('supports an inverted range for screen coordinates', () => {
    const scale = scaleLinear({ domain: [0, 100], range: [400, 0] });
    expect(scale(0)).toBe(400);
    expect(scale(100)).toBe(0);
    expect(scale(25)).toBe(300);
  });

  it('inverts back to the domain', () => {
    const scale = scaleLinear({ domain: [10, 20], range: [0, 200] });
    expect(scale.invert(100)).toBe(15);
    expect(scale.invert(scale(17))).toBeCloseTo(17, 10);
  });

  it('clamps inversion when clamping is on', () => {
    const scale = scaleLinear({ domain: [0, 10], range: [0, 100], clamp: true });
    expect(scale.invert(500)).toBe(10);
  });

  it('collapses a degenerate domain to the range midpoint', () => {
    const scale = scaleLinear({ domain: [5, 5], range: [0, 100] });
    expect(scale(5)).toBe(50);
  });

  it('propagates NaN', () => {
    const scale = scaleLinear({ domain: [0, 1], range: [0, 1] });
    expect(Number.isNaN(scale(Number.NaN))).toBe(true);
  });

  it('supports piecewise domains', () => {
    const scale = scaleLinear({ domain: [0, 50, 100], range: [0, 20, 100] });
    expect(scale(0)).toBe(0);
    expect(scale(25)).toBe(10);
    expect(scale(50)).toBe(20);
    expect(scale(75)).toBe(60);
    expect(scale(100)).toBe(100);
  });

  it('inverts piecewise domains', () => {
    const scale = scaleLinear({ domain: [0, 50, 100], range: [0, 20, 100] });
    expect(scale.invert(10)).toBeCloseTo(25, 10);
    expect(scale.invert(60)).toBeCloseTo(75, 10);
  });

  it('rounds the domain outward with nice', () => {
    expect(
      scaleLinear({ domain: [0.3, 9.4] })
        .nice()
        .domain()
    ).toEqual([0, 10]);
  });

  it('generates ticks inside the domain', () => {
    const scale = scaleLinear({ domain: [0, 10] });
    expect(scale.ticks(5)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('formats ticks at the step precision', () => {
    const format = scaleLinear({ domain: [0, 1] }).tickFormat(5);
    expect(format(0.5)).toBe('0.5');
  });

  it('accepts a custom interpolator', () => {
    const scale = scaleLinear({ domain: [0, 1], range: [0, 9] });
    scale.interpolate(interpolateRound);
    expect(scale(0.5)).toBe(5);
  });

  it('copies without aliasing state', () => {
    const original = scaleLinear({ domain: [0, 1], range: [0, 10] });
    const clone = original.copy();
    clone.domain([0, 2]);
    expect(original.domain()).toEqual([0, 1]);
    expect(clone(2)).toBe(10);
  });

  it('returns defensive copies of domain and range', () => {
    const scale = scaleLinear({ domain: [0, 1] });
    const domain = scale.domain();
    domain[0] = 99;
    expect(scale.domain()).toEqual([0, 1]);
  });
});
