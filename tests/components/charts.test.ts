import { beforeEach, describe, expect, it } from 'vitest';
import { barChart } from '@/components/bar-chart.ts';
import { lineChart } from '@/components/line-chart.ts';
import { scatterPlot } from '@/components/scatter-plot.ts';
import { histogram } from '@/components/histogram.ts';
import { pivotSeries, toDataset, totalsByCategory } from '@/components/common.ts';
import { createDataset } from '@/data/dataset.ts';
import { setScheduler } from '@/state/signal.ts';
import { findByKey, type SceneNode } from '@/renderer/scene.ts';
import { darkTheme } from '@/color/schemes.ts';

const sales = [
  { region: 'North', quarter: 'Q1', revenue: 120 },
  { region: 'North', quarter: 'Q2', revenue: 150 },
  { region: 'South', quarter: 'Q1', revenue: 90 },
  { region: 'South', quarter: 'Q2', revenue: 110 },
];

let host: HTMLDivElement;

beforeEach(() => {
  setScheduler((flush) => {
    flush();
  });
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

function keysOf(node: SceneNode | undefined): string[] {
  const out: string[] = [];
  const walk = (current: SceneNode): void => {
    out.push(current.key);
    current.children?.forEach(walk);
  };
  if (node) walk(node);
  return out;
}

describe('pivotSeries', () => {
  it('collects categories and series in first-seen order', () => {
    const pivot = pivotSeries(sales, 'region', 'revenue', 'quarter');
    expect(pivot.categories).toEqual(['North', 'South']);
    expect(pivot.seriesKeys).toEqual(['Q1', 'Q2']);
  });

  it('looks up cell values and aggregates duplicates', () => {
    const pivot = pivotSeries(
      [...sales, { region: 'North', quarter: 'Q1', revenue: 10 }],
      'region',
      'revenue',
      'quarter'
    );
    expect(pivot.valueOf('North', 'Q1')).toBe(130);
    expect(pivot.valueOf('Nowhere', 'Q1')).toBe(0);
  });

  it('falls back to the value field when no series is given', () => {
    const pivot = pivotSeries(sales, 'region', 'revenue');
    expect(pivot.seriesKeys).toEqual(['revenue']);
    expect(pivot.valueOf('North', 'revenue')).toBe(270);
  });

  it('totals each category', () => {
    const totals = totalsByCategory(pivotSeries(sales, 'region', 'revenue', 'quarter'));
    expect(totals.get('North')).toBe(270);
  });
});

describe('toDataset', () => {
  it('accepts rows or an existing dataset', () => {
    const dataset = createDataset(sales);
    expect(toDataset(dataset)).toBe(dataset);
    expect(toDataset(sales).rows).toHaveLength(4);
  });
});

describe('barChart', () => {
  it('mounts an svg into the container', () => {
    barChart(host, { data: sales, x: 'region', y: 'revenue' });
    expect(host.querySelector('svg')).not.toBeNull();
  });

  it('renders one bar per category', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    const keys = keysOf(chart.scene());
    expect(keys).toContain('bars-North');
    expect(keys).toContain('bars-South');
  });

  it('stacks by series when one is provided', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      series: 'quarter',
    });
    const keys = keysOf(chart.scene());
    expect(keys).toContain('bars-Q1-North');
    expect(keys).toContain('bars-Q2-North');
  });

  it('groups side by side when asked', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      series: 'quarter',
      grouping: 'grouped',
    });
    expect(keysOf(chart.scene())).toContain('bars-North-Q1');
  });

  it('shows a legend once there are several series', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      series: 'quarter',
    });
    expect(keysOf(chart.scene())).toContain('legend-swatch-Q1');
  });

  it('omits the legend for a single series', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    expect(keysOf(chart.scene()).some((key) => key.startsWith('legend-'))).toBe(false);
  });

  it('reuses dom elements when data changes', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    const before = host.querySelectorAll('path').length;
    chart.renderer.resetStats();

    chart.setData([
      { region: 'North', quarter: 'Q1', revenue: 200 },
      { region: 'South', quarter: 'Q1', revenue: 90 },
    ]);

    expect(host.querySelectorAll('path').length).toBe(before);
    expect(chart.renderer.stats.created).toBe(0);
  });

  it('dims other bars when one is highlighted', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    chart.highlight('North');
    const south = findByKey(chart.scene()!, 'bars-South')!;
    expect(south.attrs['fill-opacity']).toBeLessThan(1);
  });

  it('hides and restores a series', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      series: 'quarter',
    });
    chart.toggleSeries('Q1');
    expect(keysOf(chart.scene())).not.toContain('bars-Q1-North');
    chart.toggleSeries('Q1');
    expect(keysOf(chart.scene())).toContain('bars-Q1-North');
  });

  it('renders value labels on request', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      showValues: true,
    });
    expect(keysOf(chart.scene())).toContain('values-North');
  });

  it('supports horizontal orientation', () => {
    const chart = barChart(host, {
      data: sales,
      x: 'region',
      y: 'revenue',
      horizontal: true,
    });
    expect(findByKey(chart.scene()!, 'bars-North')).toBeDefined();
  });

  it('handles an empty dataset without throwing', () => {
    const chart = barChart(host, { data: [], x: 'region', y: 'revenue' });
    expect(chart.scene()).toBeDefined();
  });

  it('resizes and rerenders', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue', width: 400 });
    chart.resize({ width: 800 });
    expect(host.querySelector('svg')!.getAttribute('width')).toBe('800');
  });

  it('switches theme without recreating the chart', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    const svg = host.querySelector('svg');
    chart.setTheme(darkTheme);
    expect(host.querySelector('svg')).toBe(svg);
  });

  it('detaches on destroy', () => {
    const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
    chart.destroy();
    expect(host.querySelector('svg')).toBeNull();
  });
});

describe('lineChart', () => {
  const series = [
    { day: 1, value: 10, site: 'A' },
    { day: 2, value: 14, site: 'A' },
    { day: 3, value: 12, site: 'A' },
    { day: 1, value: 6, site: 'B' },
    { day: 2, value: 9, site: 'B' },
    { day: 3, value: 11, site: 'B' },
  ];

  it('renders one path per series', () => {
    const chart = lineChart(host, { data: series, x: 'day', y: 'value', series: 'site' });
    const keys = keysOf(chart.scene());
    expect(keys).toContain('line-A');
    expect(keys).toContain('line-B');
  });

  it('produces a path with drawing commands', () => {
    const chart = lineChart(host, { data: series, x: 'day', y: 'value', series: 'site' });
    const path = findByKey(chart.scene()!, 'line-A')!;
    expect(String(path.attrs.d)).toMatch(/^M/);
  });

  it('adds an area fill beneath the line when asked', () => {
    const chart = lineChart(host, { data: series, x: 'day', y: 'value', area: true });
    expect(keysOf(chart.scene()).some((key) => key.startsWith('area-'))).toBe(true);
  });

  it('adds point markers when asked', () => {
    const chart = lineChart(host, {
      data: series,
      x: 'day',
      y: 'value',
      series: 'site',
      showPoints: true,
    });
    expect(keysOf(chart.scene())).toContain('dots-A-0');
  });

  it('hides a series without repainting the survivors', () => {
    const chart = lineChart(host, { data: series, x: 'day', y: 'value', series: 'site' });
    const before = findByKey(chart.scene()!, 'line-B')!.attrs.stroke;
    chart.toggleSeries('A');
    expect(keysOf(chart.scene())).not.toContain('line-A');
    expect(findByKey(chart.scene()!, 'line-B')!.attrs.stroke).toBe(before);
  });

  it('handles a single data point', () => {
    const chart = lineChart(host, { data: [{ day: 1, value: 5 }], x: 'day', y: 'value' });
    expect(chart.scene()).toBeDefined();
  });
});

describe('scatterPlot', () => {
  const points = [
    { defects: 2, throughput: 100, line: 'L1' },
    { defects: 5, throughput: 80, line: 'L1' },
    { defects: 1, throughput: 120, line: 'L2' },
  ];

  it('renders one mark per row', () => {
    scatterPlot(host, { data: points, x: 'defects', y: 'throughput' });
    expect(host.querySelectorAll('circle')).toHaveLength(3);
  });

  it('colors by category and shows a legend', () => {
    const chart = scatterPlot(host, {
      data: points,
      x: 'defects',
      y: 'throughput',
      color: 'line',
    });
    const keys = keysOf(chart.scene());
    expect(keys).toContain('legend-swatch-L1');
  });

  it('caps categorical colors at the all-pairs safe limit', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((line, index) => ({
      defects: index,
      throughput: index * 2,
      line,
    }));
    scatterPlot(host, {
      data: many,
      x: 'defects',
      y: 'throughput',
      color: 'line',
    });
    const fills = new Set<string>();
    for (const element of host.querySelectorAll('circle')) {
      fills.add(element.getAttribute('fill') ?? '');
    }
    expect(fills.size).toBeLessThanOrEqual(3);
  });

  it('scales marker radius from a size field', () => {
    scatterPlot(host, {
      data: [
        { x: 1, y: 1, weight: 1 },
        { x: 2, y: 2, weight: 100 },
      ],
      x: 'x',
      y: 'y',
      size: 'weight',
    });
    const radii = [...host.querySelectorAll('circle')].map((element) =>
      Number(element.getAttribute('r'))
    );
    expect(radii[1]).toBeGreaterThan(radii[0]!);
  });

  it('gives every marker a surface ring for overlap', () => {
    scatterPlot(host, { data: points, x: 'defects', y: 'throughput' });
    expect(host.querySelector('circle')!.getAttribute('stroke-width')).toBe('2');
  });

  it('filters out hidden categories', () => {
    const chart = scatterPlot(host, {
      data: points,
      x: 'defects',
      y: 'throughput',
      color: 'line',
    });
    chart.toggleCategory('L1');
    expect(host.querySelectorAll('circle')).toHaveLength(1);
  });
});

describe('histogram', () => {
  const readings = Array.from({ length: 60 }, (_, index) => ({ value: index % 20 }));

  it('renders bins as bars', () => {
    const chart = histogram(host, { data: readings, field: 'value', binCount: 5 });
    expect(keysOf(chart.scene()).filter((key) => key.startsWith('bin-')).length).toBeGreaterThan(
      0
    );
  });

  it('exposes the computed bins', () => {
    const chart = histogram(host, { data: readings, field: 'value', binCount: 5 });
    const bins = chart.bins();
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(60);
  });

  it('recomputes when the bin count changes', () => {
    const chart = histogram(host, { data: readings, field: 'value', binCount: 4 });
    const before = chart.bins().length;
    chart.setBinCount(20);
    expect(chart.bins().length).not.toBe(before);
  });

  it('handles an empty dataset', () => {
    const chart = histogram(host, { data: [], field: 'value' });
    expect(chart.bins()).toEqual([]);
  });
});
