import type { Dataset } from '../types/data.ts';
import { categoricalSlots } from '../color/schemes.ts';
import { scaleLinear } from '../scales/linear.ts';
import { computeBins, type Bin } from '../data/transform/bin.ts';
import { formatAuto } from '../utils/format.ts';
import { toNumber } from '../utils/guards.ts';
import { group, path, type SceneNode } from '../renderer/scene.ts';
import { roundedRectPath } from '../shape/path.ts';
import { axis, grid } from './axis.ts';
import { plotBackground } from './legend.ts';
import { MARK_RADIUS, SEGMENT_GAP } from './marks.ts';
import { createChart, type Chart, type ChartContext } from './chart.ts';
import { toDataset, type BaseChartOptions, type ChartData } from './common.ts';

export interface HistogramOptions extends BaseChartOptions {
  readonly data: ChartData;
  readonly field: string;
  readonly binCount?: number;
  readonly domain?: readonly [number, number];
}

export interface HistogramState {
  readonly dataset: Dataset;
  readonly binCount: number;
  readonly highlight: number | null;
}

export type Histogram = Chart<HistogramState> & {
  setData(data: ChartData): void;
  setBinCount(count: number): void;
  bins(): Bin[];
};

export function histogram(container: Element, options: HistogramOptions): Histogram {
  const format = options.valueFormat ?? formatAuto(1);

  const binsFor = (state: HistogramState): Bin[] => {
    const values: number[] = [];
    for (const row of state.dataset.rows) {
      const value = toNumber(row[options.field] ?? null);
      if (!Number.isNaN(value)) values.push(value);
    }
    return computeBins(values, {
      field: options.field,
      count: state.binCount,
      ...(options.domain === undefined ? {} : { domain: options.domain }),
    });
  };

  const build = (state: HistogramState, context: ChartContext): SceneNode[] => {
    const { space, theme } = context;
    const bins = binsFor(state);
    const palette = categoricalSlots(1, theme.mode);
    const fill = palette[0] ?? theme.textPrimary;

    const lo = bins[0]?.start ?? 0;
    const hi = bins[bins.length - 1]?.end ?? 1;
    const maxCount = bins.reduce((peak, entry) => Math.max(peak, entry.count), 0);

    const xScale = scaleLinear({ domain: [lo, hi], range: [0, space.inner.width] });
    const yScale = scaleLinear({
      domain: [0, maxCount],
      range: [space.inner.height, 0],
    }).nice(5);

    const bars = bins.map((entry, index) => {
      const x = xScale(entry.start);
      const width = Math.max(1, xScale(entry.end) - x - SEGMENT_GAP);
      const y = yScale(entry.count);
      const height = Math.max(0, space.inner.height - y);
      return path(
        `bin-${index}`,
        {
          d: roundedRectPath(x, y, width, height, [MARK_RADIUS, MARK_RADIUS, 0, 0]),
          fill,
          'fill-opacity': state.highlight === null || state.highlight === index ? 1 : 0.35,
        },
        entry
      );
    });

    const layers: SceneNode[] = [
      plotBackground('plot-bg', {
        theme,
        width: space.inner.width,
        height: space.inner.height,
      }),
    ];

    if (options.showGrid !== false) {
      layers.push(
        grid('grid', {
          scale: yScale,
          theme,
          orientation: 'horizontal',
          length: space.inner.width,
          tickCount: 5,
        })
      );
    }

    layers.push(group({ key: 'bins' }, bars));

    layers.push(
      axis('axis-x', {
        scale: xScale,
        orientation: 'bottom',
        theme,
        length: space.inner.width,
        tickCount: 6,
        format: format as (value: never) => string,
        ...(options.xLabel === undefined ? {} : { label: options.xLabel }),
      })
    );

    layers.push(
      axis('axis-y', {
        scale: yScale,
        orientation: 'left',
        theme,
        length: space.inner.height,
        tickCount: 5,
        ...(options.yLabel === undefined ? {} : { label: options.yLabel }),
      })
    );

    return layers;
  };

  const chart = createChart<HistogramState>(container, {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
    ...(options.margin === undefined ? {} : { margin: options.margin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
    initialState: {
      dataset: toDataset(options.data),
      binCount: options.binCount ?? 12,
      highlight: null,
    },
    layers: [(state, context) => group({ key: 'histogram' }, build(state, context))],
  });

  return {
    ...chart,
    setData(data: ChartData): void {
      chart.update({ dataset: toDataset(data) });
    },
    setBinCount(count: number): void {
      chart.update({ binCount: Math.max(1, Math.round(count)) });
    },
    bins(): Bin[] {
      return binsFor(chart.store.get());
    },
  };
}
