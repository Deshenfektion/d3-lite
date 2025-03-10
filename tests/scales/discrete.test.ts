import { describe, expect, it } from 'vitest';
import { bandCenter, invertBand, scaleBand, scalePoint } from '@/scales/band.ts';
import { scaleOrdinal } from '@/scales/ordinal.ts';
import { scaleQuantize, scaleThreshold } from '@/scales/discretizing.ts';

describe('scaleOrdinal', () => {
  it('maps domain entries to range entries by position', () => {
    const scale = scaleOrdinal({ domain: ['a', 'b', 'c'], range: [1, 2, 3] });
    expect(scale('a')).toBe(1);
    expect(scale('c')).toBe(3);
  });

  it('recycles a short range', () => {
    const scale = scaleOrdinal({ domain: ['a', 'b', 'c'], range: [1, 2] });
    expect(scale('c')).toBe(1);
  });

  it('extends the domain implicitly for unseen keys', () => {
    const scale = scaleOrdinal({ range: [1, 2] });
    expect(scale('x')).toBe(1);
    expect(scale('y')).toBe(2);
    expect(scale.domain()).toEqual(['x', 'y']);
  });

  it('returns the unknown value instead of extending when configured', () => {
    const scale = scaleOrdinal({ domain: ['a'], range: [1], unknown: -1 });
    expect(scale('zzz')).toBe(-1);
    expect(scale.domain()).toEqual(['a']);
  });

  it('deduplicates the domain', () => {
    const scale = scaleOrdinal({ range: [1, 2] });
    scale.domain(['a', 'a', 'b']);
    expect(scale.domain()).toEqual(['a', 'b']);
  });

  it('is stable under reordering of the input data', () => {
    const scale = scaleOrdinal({ domain: ['a', 'b', 'c'], range: [1, 2, 3] });
    const before = scale('b');
    scale.domain(['a', 'b', 'c']);
    expect(scale('b')).toBe(before);
  });

  it('copies independently', () => {
    const original = scaleOrdinal({ domain: ['a'], range: [1] });
    const clone = original.copy();
    clone.domain(['z']);
    expect(original.domain()).toEqual(['a']);
  });
});

describe('scaleBand', () => {
  it('divides the range into equal bands', () => {
    const scale = scaleBand({ domain: ['a', 'b', 'c'], range: [0, 300] });
    expect(scale('a')).toBe(0);
    expect(scale('b')).toBe(100);
    expect(scale('c')).toBe(200);
    expect(scale.bandwidth()).toBe(100);
    expect(scale.step()).toBe(100);
  });

  it('applies inner padding between bands', () => {
    const scale = scaleBand({ domain: ['a', 'b'], range: [0, 100], paddingInner: 0.5 });
    expect(scale.step()).toBeCloseTo(66.667, 3);
    expect(scale.bandwidth()).toBeCloseTo(33.333, 3);
  });

  it('applies outer padding at both edges', () => {
    const scale = scaleBand({ domain: ['a', 'b'], range: [0, 100], paddingOuter: 0.5 });
    expect(scale('a')).toBeGreaterThan(0);
  });

  it('rounds positions to whole pixels when asked', () => {
    const scale = scaleBand({ domain: ['a', 'b', 'c'], range: [0, 100], round: true });
    for (const key of scale.domain()) expect(Number.isInteger(scale(key))).toBe(true);
    expect(Number.isInteger(scale.bandwidth())).toBe(true);
  });

  it('handles a reversed range', () => {
    const scale = scaleBand({ domain: ['a', 'b'], range: [200, 0] });
    expect(scale('a')).toBe(100);
    expect(scale('b')).toBe(0);
  });

  it('returns NaN for unknown keys', () => {
    const scale = scaleBand({ domain: ['a'], range: [0, 10] });
    expect(Number.isNaN(scale('missing'))).toBe(true);
  });

  it('handles an empty domain without dividing by zero', () => {
    const scale = scaleBand({ domain: [], range: [0, 100] });
    expect(scale.bandwidth()).toBe(0);
    expect(scale.step()).toBe(0);
  });

  it('handles a single band', () => {
    const scale = scaleBand({ domain: ['only'], range: [0, 100] });
    expect(scale('only')).toBe(0);
    expect(scale.bandwidth()).toBe(100);
  });

  it('computes band centres', () => {
    const scale = scaleBand({ domain: ['a', 'b'], range: [0, 200] });
    expect(bandCenter(scale, 'a')).toBe(50);
  });

  it('inverts a pixel position back to a band', () => {
    const scale = scaleBand({ domain: ['a', 'b', 'c'], range: [0, 300] });
    expect(invertBand(scale, 150)).toBe('b');
    expect(invertBand(scale, 999)).toBeUndefined();
  });

  it('updates lazily when padding changes', () => {
    const scale = scaleBand({ domain: ['a', 'b'], range: [0, 100] });
    const before = scale.bandwidth();
    scale.padding(0.5);
    expect(scale.bandwidth()).toBeLessThan(before);
  });
});

describe('scalePoint', () => {
  it('places points with zero bandwidth', () => {
    const scale = scalePoint({ domain: ['a', 'b', 'c'], range: [0, 200] });
    expect(scale.bandwidth()).toBe(0);
    expect(scale('a')).toBe(0);
    expect(scale('c')).toBe(200);
  });

  it('honours outer padding', () => {
    const scale = scalePoint({ domain: ['a', 'b'], range: [0, 100], padding: 0.5 });
    expect(scale('a')).toBeGreaterThan(0);
  });
});

describe('scaleQuantize', () => {
  const scale = scaleQuantize({ domain: [0, 100], range: ['low', 'mid', 'high'] });

  it('splits a continuous domain into equal buckets', () => {
    expect(scale(0)).toBe('low');
    expect(scale(50)).toBe('mid');
    expect(scale(99)).toBe('high');
  });

  it('clamps values outside the domain', () => {
    expect(scale(-10)).toBe('low');
    expect(scale(1000)).toBe('high');
  });

  it('exposes the internal thresholds', () => {
    expect(scale.thresholds()).toEqual([100 / 3, 200 / 3]);
  });

  it('recovers the extent that produced a bucket', () => {
    expect(scale.invertExtent('mid')).toEqual([100 / 3, 200 / 3]);
    expect(scale.invertExtent('nope')).toBeUndefined();
  });
});

describe('scaleThreshold', () => {
  const scale = scaleThreshold({ domain: [10, 20], range: ['cold', 'warm', 'hot'] });

  it('selects the bucket above each threshold', () => {
    expect(scale(5)).toBe('cold');
    expect(scale(10)).toBe('warm');
    expect(scale(15)).toBe('warm');
    expect(scale(25)).toBe('hot');
  });

  it('reports open-ended extents', () => {
    expect(scale.invertExtent('cold')).toEqual([Number.NEGATIVE_INFINITY, 10]);
    expect(scale.invertExtent('hot')).toEqual([20, Number.POSITIVE_INFINITY]);
  });
});
