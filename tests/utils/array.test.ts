import { describe, expect, it } from 'vitest';
import {
  bisectLeft,
  bisectRight,
  deviation,
  extent,
  group,
  last,
  max,
  mean,
  median,
  min,
  pairs,
  quantile,
  quantileSorted,
  range,
  rollup,
  sum,
  unique,
  variance,
  zip,
} from '@/utils/array.ts';
import { identity } from '@/utils/functional.ts';

describe('range', () => {
  it('generates a half-open interval', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  it('supports fractional and negative steps', () => {
    expect(range(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(range(3, 0, -1)).toEqual([3, 2, 1]);
  });

  it('returns empty for degenerate steps', () => {
    expect(range(0, 10, 0)).toEqual([]);
    expect(range(5, 0)).toEqual([]);
  });
});

describe('statistics', () => {
  const values = [4, 1, 9, 3, 7];

  it('computes min, max and extent', () => {
    expect(min(values, identity)).toBe(1);
    expect(max(values, identity)).toBe(9);
    expect(extent(values, identity)).toEqual([1, 9]);
  });

  it('ignores NaN entries', () => {
    const dirty = [4, Number.NaN, 9];
    expect(extent(dirty, identity)).toEqual([4, 9]);
    expect(sum(dirty, identity)).toBe(13);
    expect(mean(dirty, identity)).toBe(6.5);
  });

  it('returns undefined for empty input', () => {
    expect(extent([], identity)).toBeUndefined();
    expect(mean([], identity)).toBeUndefined();
    expect(min([], identity)).toBeUndefined();
  });

  it('computes quantiles with linear interpolation', () => {
    expect(quantileSorted([1, 2, 3, 4], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile(values, 0.5, identity)).toBe(4);
    expect(median(values, identity)).toBe(4);
  });

  it('computes sample variance and deviation', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9], identity)).toBeCloseTo(4.571, 3);
    expect(deviation([2, 4, 4, 4, 5, 5, 7, 9], identity)).toBeCloseTo(2.138, 3);
    expect(variance([1], identity)).toBeUndefined();
  });
});

describe('bisect', () => {
  const sorted = [1, 2, 2, 2, 5, 8];

  it('finds insertion points around duplicates', () => {
    expect(bisectLeft(sorted, 2)).toBe(1);
    expect(bisectRight(sorted, 2)).toBe(4);
  });

  it('handles out-of-range values', () => {
    expect(bisectLeft(sorted, 0)).toBe(0);
    expect(bisectRight(sorted, 100)).toBe(6);
  });
});

describe('grouping', () => {
  const rows = [
    { team: 'a', score: 1 },
    { team: 'b', score: 5 },
    { team: 'a', score: 3 },
  ];

  it('groups by key preserving order', () => {
    const grouped = group(rows, (r) => r.team);
    expect([...grouped.keys()]).toEqual(['a', 'b']);
    expect(grouped.get('a')).toHaveLength(2);
  });

  it('rolls groups up to a single value', () => {
    const totals = rollup(
      rows,
      (r) => r.team,
      (bucket) => sum(bucket, (r) => r.score)
    );
    expect(totals.get('a')).toBe(4);
    expect(totals.get('b')).toBe(5);
  });
});

describe('helpers', () => {
  it('deduplicates preserving first occurrence', () => {
    expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it('zips to the shorter length', () => {
    expect(zip([1, 2, 3], ['a', 'b'])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('produces adjacent pairs', () => {
    expect(pairs([1, 2, 3])).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(pairs([1])).toEqual([]);
  });

  it('reads the last element safely', () => {
    expect(last([1, 2])).toBe(2);
    expect(last([])).toBeUndefined();
  });
});
