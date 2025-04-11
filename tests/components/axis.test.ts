import { describe, expect, it } from 'vitest';
import { axis, grid, isBandScale } from '@/components/axis.ts';
import { legend, valueLabels } from '@/components/legend.ts';
import { scaleBand } from '@/scales/band.ts';
import { scaleLinear } from '@/scales/linear.ts';
import { lightTheme } from '@/color/schemes.ts';
import { countNodes, findByKey, type SceneNode } from '@/renderer/scene.ts';

const theme = lightTheme;

function labelsOf(node: SceneNode): string[] {
  const out: string[] = [];
  const walk = (current: SceneNode): void => {
    if (current.type === 'text' && current.text !== undefined) out.push(current.text);
    current.children?.forEach(walk);
  };
  walk(node);
  return out;
}

describe('isBandScale', () => {
  it('distinguishes band scales from continuous ones', () => {
    expect(isBandScale(scaleBand({ domain: ['a'], range: [0, 10] }))).toBe(true);
    expect(isBandScale(scaleLinear({ domain: [0, 1] }))).toBe(false);
  });
});

describe('axis', () => {
  const linear = scaleLinear({ domain: [0, 100], range: [200, 0] });

  it('emits one tick and one label per tick value', () => {
    const node = axis('axis-y', {
      scale: linear,
      orientation: 'left',
      theme,
      length: 200,
      tickCount: 5,
    });
    const labels = labelsOf(node);
    expect(labels).toEqual(['0', '20', '40', '60', '80', '100']);
  });

  it('positions ticks through the scale', () => {
    const node = axis('axis-y', {
      scale: linear,
      orientation: 'left',
      theme,
      length: 200,
      tickCount: 5,
    });
    const tick = findByKey(node, 'axis-y-tick-0')!;
    expect(tick.attrs.y1).toBe(200);
  });

  it('labels every category for a band scale', () => {
    const band = scaleBand({ domain: ['North', 'South'], range: [0, 200] });
    const node = axis('axis-x', {
      scale: band,
      orientation: 'bottom',
      theme,
      length: 200,
    });
    expect(labelsOf(node)).toEqual(['North', 'South']);
  });

  it('centres band tick marks in their band', () => {
    const band = scaleBand({ domain: ['a', 'b'], range: [0, 200] });
    const node = axis('axis-x', { scale: band, orientation: 'bottom', theme, length: 200 });
    expect(findByKey(node, 'axis-x-tick-a')!.attrs.x1).toBe(50);
  });

  it('flips tick direction for top and left orientations', () => {
    const bottom = axis('b', { scale: linear, orientation: 'bottom', theme, length: 200 });
    const top = axis('t', { scale: linear, orientation: 'top', theme, length: 200 });
    expect(Number(findByKey(bottom, 'b-tick-0')!.attrs.y2)).toBeGreaterThan(
      Number(findByKey(bottom, 'b-tick-0')!.attrs.y1)
    );
    expect(Number(findByKey(top, 't-tick-0')!.attrs.y2)).toBeLessThan(
      Number(findByKey(top, 't-tick-0')!.attrs.y1)
    );
  });

  it('truncates long category labels', () => {
    const band = scaleBand({
      domain: ['an extremely long category name'],
      range: [0, 200],
    });
    const node = axis('axis-x', {
      scale: band,
      orientation: 'bottom',
      theme,
      length: 200,
      maxLabelLength: 10,
    });
    expect(labelsOf(node)[0]).toBe('an extrem…');
  });

  it('applies a custom formatter', () => {
    const node = axis('axis-y', {
      scale: linear,
      orientation: 'left',
      theme,
      length: 200,
      tickCount: 2,
      format: ((value: number) => `${value}%`) as (value: never) => string,
    });
    expect(labelsOf(node)[0]).toBe('0%');
  });

  it('draws the domain line only when a length is known', () => {
    const withDomain = axis('a', { scale: linear, orientation: 'left', theme, length: 200 });
    const withoutDomain = axis('a', { scale: linear, orientation: 'left', theme });
    expect(findByKey(withDomain, 'a-domain')).toBeDefined();
    expect(findByKey(withoutDomain, 'a-domain')).toBeUndefined();
  });

  it('adds an axis title when requested', () => {
    const node = axis('a', {
      scale: linear,
      orientation: 'left',
      theme,
      length: 200,
      label: 'Revenue',
    });
    expect(labelsOf(node)).toContain('Revenue');
  });

  it('paints labels with ink tokens rather than a series color', () => {
    const node = axis('a', { scale: linear, orientation: 'left', theme, length: 200 });
    const label = findByKey(node, 'a-label-0')!;
    expect(label.attrs.fill).toBe(theme.textMuted);
  });
});

describe('grid', () => {
  it('emits one line per tick spanning the plot', () => {
    const node = grid('grid', {
      scale: scaleLinear({ domain: [0, 100], range: [200, 0] }),
      theme,
      orientation: 'horizontal',
      length: 400,
      tickCount: 5,
    });
    expect(countNodes(node) - 1).toBe(6);
    expect(findByKey(node, 'grid-0')!.attrs.x2).toBe(400);
  });

  it('uses the recessive gridline token', () => {
    const node = grid('grid', {
      scale: scaleLinear({ domain: [0, 10], range: [100, 0] }),
      theme,
      orientation: 'horizontal',
      length: 200,
    });
    expect(findByKey(node, 'grid-0')!.attrs.stroke).toBe(theme.gridline);
  });
});

describe('legend', () => {
  it('renders a swatch and label per entry', () => {
    const node = legend('legend', {
      theme,
      entries: [
        { key: 'north', label: 'North', color: '#2a78d6' },
        { key: 'south', label: 'South', color: '#eb6834' },
      ],
    });
    expect(labelsOf(node)).toEqual(['North', 'South']);
    expect(findByKey(node, 'legend-swatch-north')!.attrs.fill).toBe('#2a78d6');
  });

  it('mutes hidden series', () => {
    const node = legend('legend', {
      theme,
      entries: [{ key: 'north', label: 'North', color: '#2a78d6', muted: true }],
    });
    expect(findByKey(node, 'legend-swatch-north')!.attrs['fill-opacity']).toBeLessThan(1);
  });

  it('wraps entries into columns', () => {
    const node = legend('legend', {
      theme,
      columns: 2,
      entries: [
        { key: 'a', label: 'A', color: '#000' },
        { key: 'b', label: 'B', color: '#111' },
        { key: 'c', label: 'C', color: '#222' },
      ],
    });
    const first = findByKey(node, 'legend-swatch-a')!;
    const third = findByKey(node, 'legend-swatch-c')!;
    expect(third.attrs.d).not.toBe(first.attrs.d);
  });
});

describe('valueLabels', () => {
  it('uses tabular figures for aligned numbers', () => {
    const node = valueLabels('values', {
      theme,
      entries: [{ key: 'a', x: 10, y: 20, label: '1,200' }],
    });
    const label = findByKey(node, 'values-a')!;
    expect(label.attrs['font-variant-numeric']).toBe('tabular-nums');
    expect(label.attrs.fill).toBe(theme.textSecondary);
  });
});
