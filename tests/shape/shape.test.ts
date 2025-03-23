import { describe, expect, it } from 'vitest';
import { PathBuilder, roundedRectPath } from '@/shape/path.ts';
import { curveFor, curveLinear, curveMonotoneX, curveStep } from '@/shape/curves.ts';
import { areaPath, linePath, segmentsOf } from '@/shape/line.ts';
import { symbolPath } from '@/shape/symbol.ts';
import { stack, stackExtent } from '@/layout/stack.ts';
import { applySegmentGap, groupedBand, layoutBars } from '@/layout/marks.ts';
import { scaleBand } from '@/scales/band.ts';
import { scaleLinear } from '@/scales/linear.ts';

describe('PathBuilder', () => {
  it('emits compact commands', () => {
    const builder = new PathBuilder();
    builder.moveTo(0, 0);
    builder.lineTo(10, 20);
    builder.closePath();
    expect(builder.toString()).toBe('M0,0L10,20Z');
  });

  it('rounds coordinates to the configured precision', () => {
    const builder = new PathBuilder(1);
    builder.moveTo(1.26, 3.999);
    expect(builder.toString()).toBe('M1.3,4');
  });

  it('normalizes negative zero', () => {
    const builder = new PathBuilder();
    builder.moveTo(-0.001, 0);
    expect(builder.toString()).toBe('M0,0');
  });

  it('tracks emptiness and clears', () => {
    const builder = new PathBuilder();
    expect(builder.isEmpty()).toBe(true);
    builder.moveTo(1, 1);
    expect(builder.isEmpty()).toBe(false);
    builder.clear();
    expect(builder.isEmpty()).toBe(true);
  });
});

describe('roundedRectPath', () => {
  it('produces a closed path with arcs', () => {
    const path = roundedRectPath(0, 0, 100, 50, [4, 4, 0, 0]);
    expect(path.startsWith('M4,0')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('A4,4');
  });

  it('clamps radii to half the shortest side', () => {
    const path = roundedRectPath(0, 0, 10, 10, [999, 999, 999, 999]);
    expect(path).toContain('A5,5');
  });

  it('omits arcs for zero radii', () => {
    expect(roundedRectPath(0, 0, 10, 10, [0, 0, 0, 0])).not.toContain('A');
  });
});

describe('curves', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 5 },
  ];

  it('draws straight segments for the linear curve', () => {
    expect(linePath(points)).toBe('M0,0L10,10L20,5');
  });

  it('draws right-angled segments for the step curve', () => {
    const path = linePath(points, { curve: 'step' });
    expect(path.startsWith('M0,0L5,0L5,10L10,10')).toBe(true);
  });

  it('emits beziers for the monotone curve', () => {
    expect(linePath(points, { curve: 'monotoneX' })).toContain('C');
  });

  it('never overshoots a local extremum with monotoneX', () => {
    const builder = new PathBuilder(4);
    curveMonotoneX(builder, [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
      { x: 2, y: 10 },
      { x: 3, y: 0 },
    ]);
    const numbers = builder
      .toString()
      .split(/[^0-9.-]+/)
      .filter(Boolean)
      .map(Number);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(10.0001);
  });

  it('falls back to linear for fewer than three points', () => {
    const two = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];
    expect(linePath(two, { curve: 'monotoneX' })).toBe('M0,0L5,5');
    expect(linePath(two, { curve: 'basis' })).toBe('M0,0L5,5');
  });

  it('resolves curves by name', () => {
    expect(curveFor('linear')).toBe(curveLinear);
    expect(curveFor('step')).toBe(curveStep);
  });

  it('handles an empty point list', () => {
    expect(linePath([])).toBe('');
  });
});

describe('segmentsOf', () => {
  it('splits on non-finite coordinates', () => {
    const segments = segmentsOf([
      { x: 0, y: 0 },
      { x: 1, y: Number.NaN },
      { x: 2, y: 2 },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
  });

  it('keeps original indices for baseline lookup', () => {
    const segments = segmentsOf([
      { x: 0, y: Number.NaN },
      { x: 1, y: 1 },
    ]);
    expect(segments[0]![0]!.index).toBe(1);
  });

  it('honours a custom defined predicate', () => {
    const segments = segmentsOf(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      (_, index) => index !== 0
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(1);
  });
});

describe('areaPath', () => {
  const points = [
    { x: 0, y: 10 },
    { x: 10, y: 20 },
  ];

  it('closes the shape against a flat baseline', () => {
    const path = areaPath(points, 100);
    expect(path).toBe('M0,10L10,20L10,100L0,100Z');
  });

  it('closes against a point baseline in reverse order', () => {
    const path = areaPath(points, [
      { x: 0, y: 50 },
      { x: 10, y: 60 },
    ]);
    expect(path).toBe('M0,10L10,20L10,60L0,50Z');
  });

  it('produces one closed shape per defined segment', () => {
    const path = areaPath(
      [{ x: 0, y: 1 }, { x: 1, y: Number.NaN }, { x: 2, y: 3 }],
      0
    );
    expect(path.split('Z')).toHaveLength(3);
  });

  it('curves the baseline with the same curve as the top edge', () => {
    const curved = areaPath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
        { x: 2, y: 2 },
      ],
      [
        { x: 0, y: 10 },
        { x: 1, y: 12 },
        { x: 2, y: 11 },
      ],
      { curve: 'monotoneX' }
    );
    expect(curved.match(/C/g)!.length).toBeGreaterThan(2);
  });
});

describe('symbolPath', () => {
  it('produces a closed path for every symbol', () => {
    for (const kind of ['circle', 'square', 'triangle', 'diamond', 'cross'] as const) {
      const path = symbolPath(kind, 64);
      expect(path.length).toBeGreaterThan(0);
      expect(path.endsWith('Z')).toBe(true);
    }
  });

  it('scales with the requested area', () => {
    const small = symbolPath('square', 16);
    const large = symbolPath('square', 64);
    expect(small).not.toBe(large);
  });
});

describe('stack layout', () => {
  const rows = [
    { month: 'Jan', a: 10, b: 20 },
    { month: 'Feb', a: 30, b: 10 },
  ];

  it('accumulates series bottom to top', () => {
    const series = stack(rows, { keys: ['a', 'b'] });
    expect(series[0]![0]).toMatchObject({ start: 0, end: 10 });
    expect(series[1]![0]).toMatchObject({ start: 10, end: 30 });
  });

  it('normalizes to unit height with the expand offset', () => {
    const series = stack(rows, { keys: ['a', 'b'], offset: 'expand' });
    expect(series[1]![0]!.end).toBeCloseTo(1, 10);
  });

  it('avoids dividing by zero for empty rows', () => {
    const series = stack([{ a: 0, b: 0 }], { keys: ['a', 'b'], offset: 'expand' });
    expect(series[1]![0]!.end).toBe(0);
  });

  it('separates signs with the diverging offset', () => {
    const series = stack([{ a: -5, b: 10 }], { keys: ['a', 'b'], offset: 'diverging' });
    expect(series[0]![0]).toMatchObject({ start: 0, end: -5 });
    expect(series[1]![0]).toMatchObject({ start: 0, end: 10 });
  });

  it('treats missing values as zero', () => {
    const series = stack([{ a: null, b: 5 }], { keys: ['a', 'b'] });
    expect(series[0]![0]!.value).toBe(0);
    expect(series[1]![0]!.end).toBe(5);
  });

  it('orders series by total', () => {
    const ascending = stack(rows, { keys: ['a', 'b'], order: 'ascending' });
    expect(ascending[0]![0]!.key).toBe('b');
  });

  it('reports the stacked extent', () => {
    expect(stackExtent(stack(rows, { keys: ['a', 'b'] }))).toEqual([0, 40]);
  });
});

describe('bar layout', () => {
  const band = scaleBand({ domain: ['a', 'b'], range: [0, 200] });
  const value = scaleLinear({ domain: [0, 100], range: [200, 0] });

  it('anchors bars to the zero baseline', () => {
    const [first] = layoutBars([{ key: 'a', value: 50 }], { band, value });
    expect(first).toMatchObject({ x: 0, y: 100, width: 100, height: 100 });
  });

  it('grows negative bars downward from zero', () => {
    const negativeScale = scaleLinear({ domain: [-100, 100], range: [200, 0] });
    const [bar] = layoutBars([{ key: 'a', value: -50 }], { band, value: negativeScale });
    expect(bar!.negative).toBe(true);
    expect(bar!.y).toBe(100);
    expect(bar!.height).toBe(50);
  });

  it('enforces a minimum visible length', () => {
    const [bar] = layoutBars([{ key: 'a', value: 0 }], { band, value, minLength: 2 });
    expect(bar!.height).toBe(2);
  });

  it('supports horizontal orientation', () => {
    const horizontal = scaleLinear({ domain: [0, 100], range: [0, 200] });
    const [bar] = layoutBars([{ key: 'a', value: 50 }], {
      band,
      value: horizontal,
      horizontal: true,
    });
    expect(bar).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe('grouped bands', () => {
  it('splits a band between series', () => {
    const band = scaleBand({ domain: ['a'], range: [0, 120] });
    const grouped = groupedBand({ band, seriesCount: 3 });
    expect(grouped.width).toBeCloseTo(36.8, 1);
    expect(grouped.offsetFor(0)).toBeLessThan(grouped.offsetFor(1));
  });
});

describe('applySegmentGap', () => {
  it('inserts a surface gap between adjacent segments', () => {
    const middle = applySegmentGap(0, 100, 2, false, false);
    expect(middle).toEqual({ start: 1, length: 98 });
  });

  it('does not inset the outer edges', () => {
    expect(applySegmentGap(0, 100, 2, true, false)).toEqual({ start: 0, length: 99 });
    expect(applySegmentGap(0, 100, 2, false, true)).toEqual({ start: 1, length: 99 });
  });

  it('never returns a negative length', () => {
    expect(applySegmentGap(0, 1, 10, false, false).length).toBe(0);
  });
});
