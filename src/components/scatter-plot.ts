import type { Dataset } from '../types/data.ts';
import { ALL_PAIRS_CATEGORICAL_LIMIT, categoricalSlots } from '../color/schemes.ts';
import { scaleLinear } from '../scales/linear.ts';
import { scaleSqrt } from '../scales/pow.ts';
import { formatAuto } from '../utils/format.ts';
import { toNumber, toStringKey } from '../utils/guards.ts';
import { group, type SceneNode } from '../renderer/scene.ts';
import { axis, grid } from './axis.ts';
import { legend, plotBackground } from './legend.ts';
import { pointMarks } from './marks.ts';
import { createChart, type Chart, type ChartContext } from './chart.ts';
import { numericExtent } from '../encode/channel.ts';
import { toDataset, type BaseChartOptions, type ChartData } from './common.ts';

export interface ScatterPlotOptions extends BaseChartOptions {
  readonly data: ChartData;
  readonly x: string;
  readonly y: string;
  readonly color?: string;
  readonly size?: string;
  readonly sizeRange?: readonly [number, number];
  readonly opacity?: number;
}

export interface ScatterPlotState {
  readonly dataset: Dataset;
  readonly hiddenCategories: readonly string[];
  readonly highlight: string | null;
}

export type ScatterPlot = Chart<ScatterPlotState> & {
  setData(data: ChartData): void;
  toggleCategory(key: string): void;
  highlight(key: string | null): void;
};

export function scatterPlot(container: Element, options: ScatterPlotOptions): ScatterPlot {
  const format = options.valueFormat ?? formatAuto(1);

  const build = (state: ScatterPlotState, context: ChartContext): SceneNode[] => {
    const { space, theme } = context;
    const allRows = state.dataset.rows;

    const categories: string[] = [];
    if (options.color) {
      const seen = new Set<string>();
      for (const row of allRows) {
        const key = toStringKey(row[options.color] ?? null);
        if (seen.has(key)) continue;
        seen.add(key);
        categories.push(key);
      }
    }

    const rows = options.color
      ? allRows.filter(
          (row) => !state.hiddenCategories.includes(toStringKey(row[options.color!] ?? null))
        )
      : allRows;

    const palette = categoricalSlots(
      Math.min(categories.length || 1, ALL_PAIRS_CATEGORICAL_LIMIT),
      theme.mode
    );
    const colorFor = (key: string): string => {
      const index = categories.indexOf(key);
      return palette[Math.max(0, index) % palette.length] ?? palette[0] ?? theme.textPrimary;
    };

    const xExtent = numericExtent(rows, options.x) ?? [0, 1];
    const yExtent = numericExtent(rows, options.y) ?? [0, 1];

    const xScale = scaleLinear({
      domain: xExtent,
      range: [0, space.inner.width],
    }).nice(6);
    const yScale = scaleLinear({
      domain: yExtent,
      range: [space.inner.height, 0],
    }).nice(5);

    const sizeExtent = options.size ? (numericExtent(rows, options.size) ?? [0, 1]) : undefined;
    const sizeScale =
      options.size && sizeExtent
        ? scaleSqrt({
            domain: [0, sizeExtent[1]],
            range: options.sizeRange ? [...options.sizeRange] : [4, 16],
          })
        : undefined;

    const layers: SceneNode[] = [
      plotBackground('plot-bg', {
        theme,
        width: space.inner.width,
        height: space.inner.height,
      }),
    ];

    if (options.showGrid !== false) {
      layers.push(
        grid('grid-y', {
          scale: yScale,
          theme,
          orientation: 'horizontal',
          length: space.inner.width,
          tickCount: 5,
        })
      );
      layers.push(
        grid('grid-x', {
          scale: xScale,
          theme,
          orientation: 'vertical',
          length: space.inner.height,
          tickCount: 6,
        })
      );
    }

    layers.push(
      pointMarks('points', {
        theme,
        opacity: options.opacity ?? 0.85,
        color: (key) => {
          const row = rows[Number(key)];
          if (!row || !options.color) return palette[0] ?? theme.textPrimary;
          return colorFor(toStringKey(row[options.color] ?? null));
        },
        radius: (key) => {
          const row = rows[Number(key)];
          if (!row || !sizeScale || !options.size) return 4;
          return Math.max(4, sizeScale(toNumber(row[options.size] ?? null)) / 2);
        },
        points: rows.map((row, index) => ({
          key: String(index),
          x: xScale(toNumber(row[options.x] ?? null)),
          y: yScale(toNumber(row[options.y] ?? null)),
          datum: row,
        })),
      })
    );

    layers.push(
      axis('axis-x', {
        scale: xScale,
        orientation: 'bottom',
        theme,
        length: space.inner.width,
        tickCount: 6,
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
        format: format as (value: never) => string,
        ...(options.yLabel === undefined ? {} : { label: options.yLabel }),
      })
    );

    if (categories.length > 1 && options.showLegend !== false) {
      layers.push(
        legend('legend', {
          theme,
          x: 0,
          y: -space.margin.top + 4,
          entries: categories.map((key) => ({
            key,
            label: key,
            color: colorFor(key),
            muted: state.hiddenCategories.includes(key),
          })),
        })
      );
    }

    return layers;
  };

  const chart = createChart<ScatterPlotState>(container, {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
    ...(options.margin === undefined ? {} : { margin: options.margin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
    initialState: {
      dataset: toDataset(options.data),
      hiddenCategories: [],
      highlight: null,
    },
    layers: [(state, context) => group({ key: 'scatter-plot' }, build(state, context))],
  });

  return {
    ...chart,
    setData(data: ChartData): void {
      chart.update({ dataset: toDataset(data) });
    },
    toggleCategory(key: string): void {
      const hidden = chart.store.get().hiddenCategories;
      chart.update({
        hiddenCategories: hidden.includes(key)
          ? hidden.filter((entry) => entry !== key)
          : [...hidden, key],
      });
    },
    highlight(key: string | null): void {
      chart.update({ highlight: key });
    },
  };
}
