import type { Dataset } from '../types/data.ts';
import { categoricalSlots } from '../color/schemes.ts';
import { scaleBand } from '../scales/band.ts';
import { scaleLinear } from '../scales/linear.ts';
import { stack, stackExtent } from '../layout/stack.ts';
import { formatAuto } from '../utils/format.ts';
import { group, type SceneNode } from '../renderer/scene.ts';
import { axis, grid } from './axis.ts';
import { legend, plotBackground, valueLabels } from './legend.ts';
import { barMarks, groupedBarMarks, stackedBarMarks } from './marks.ts';
import { createChart, type Chart, type ChartContext } from './chart.ts';
import {
  pivotSeries,
  pivotToRows,
  toDataset,
  totalsByCategory,
  type BaseChartOptions,
  type ChartData,
} from './common.ts';

export type BarGrouping = 'single' | 'grouped' | 'stacked';

export interface BarChartOptions extends BaseChartOptions {
  readonly data: ChartData;
  readonly x: string;
  readonly y: string;
  readonly series?: string;
  readonly grouping?: BarGrouping;
  readonly horizontal?: boolean;
  readonly showValues?: boolean;
  readonly padding?: number;
}

export interface BarChartState {
  readonly dataset: Dataset;
  readonly highlight: string | null;
  readonly hiddenSeries: readonly string[];
}

export type BarChart = Chart<BarChartState> & {
  setData(data: ChartData): void;
  highlight(key: string | null): void;
  toggleSeries(key: string): void;
};

export function barChart(container: Element, options: BarChartOptions): BarChart {
  const grouping: BarGrouping = options.grouping ?? (options.series ? 'stacked' : 'single');
  const format = options.valueFormat ?? formatAuto(1);
  const padding = options.padding ?? 0.2;

  const build = (state: BarChartState, context: ChartContext): SceneNode[] => {
    const { space, theme } = context;
    const rows = state.dataset.rows;
    const pivot = pivotSeries(rows, options.x, options.y, options.series);
    const visibleSeries = pivot.seriesKeys.filter(
      (key) => !state.hiddenSeries.includes(key)
    );
    const palette = categoricalSlots(pivot.seriesKeys.length, theme.mode);
    const colorFor = (seriesKey: string): string => {
      const index = pivot.seriesKeys.indexOf(seriesKey);
      return palette[index % palette.length] ?? palette[0] ?? theme.textPrimary;
    };

    const band = scaleBand({
      domain: pivot.categories,
      range: options.horizontal ? [0, space.inner.height] : [0, space.inner.width],
      padding,
    });

    let valueExtent: [number, number];
    if (grouping === 'stacked' && visibleSeries.length > 0) {
      const stacked = stack(pivotToRows(pivot, options.x), { keys: visibleSeries });
      valueExtent = stackExtent(stacked);
    } else {
      let hi = 0;
      let lo = 0;
      for (const category of pivot.categories) {
        for (const seriesKey of visibleSeries) {
          const value = pivot.valueOf(category, seriesKey);
          if (value > hi) hi = value;
          if (value < lo) lo = value;
        }
      }
      valueExtent = [lo, hi];
    }

    const value = scaleLinear({
      domain: valueExtent,
      range: options.horizontal ? [0, space.inner.width] : [space.inner.height, 0],
    }).nice(5);

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
          scale: value,
          theme,
          orientation: options.horizontal ? 'vertical' : 'horizontal',
          length: options.horizontal ? space.inner.height : space.inner.width,
          tickCount: 5,
        })
      );
    }

    if (grouping === 'stacked' && options.series && visibleSeries.length > 0) {
      const stacked = stack(pivotToRows(pivot, options.x), { keys: visibleSeries });
      layers.push(
        stackedBarMarks('bars', {
          series: stacked,
          band,
          value,
          categories: pivot.categories,
          color: colorFor,
        })
      );
    } else if (grouping === 'grouped' && options.series) {
      layers.push(
        groupedBarMarks('bars', {
          categories: pivot.categories,
          seriesKeys: visibleSeries,
          valueOf: pivot.valueOf.bind(pivot),
          band,
          value,
          color: colorFor,
        })
      );
    } else {
      const seriesKey = visibleSeries[0] ?? options.y;
      const entries = pivot.categories.map((category) => ({
        key: category,
        value: pivot.valueOf(category, seriesKey),
      }));
      layers.push(
        barMarks('bars', {
          entries,
          band,
          value,
          color: palette[0] ?? theme.textPrimary,
          ...(options.horizontal === undefined ? {} : { horizontal: options.horizontal }),
          opacity: (key) => (state.highlight && state.highlight !== key ? 0.35 : 1),
        })
      );

      if (options.showValues) {
        const totals = totalsByCategory(pivot);
        layers.push(
          valueLabels('values', {
            theme,
            entries: entries.map((entry) => ({
              key: entry.key,
              x: options.horizontal
                ? value(entry.value) + 6
                : band(entry.key) + band.bandwidth() / 2,
              y: options.horizontal
                ? band(entry.key) + band.bandwidth() / 2 + 4
                : value(entry.value),
              label: format(totals.get(entry.key) ?? entry.value),
            })),
            anchor: options.horizontal ? 'start' : 'middle',
            dy: options.horizontal ? 0 : -6,
          })
        );
      }
    }

    layers.push(
      axis('axis-x', {
        scale: options.horizontal ? value : band,
        orientation: 'bottom',
        theme,
        length: space.inner.width,
        ...(options.xLabel === undefined ? {} : { label: options.xLabel }),
      })
    );

    layers.push(
      axis('axis-y', {
        scale: options.horizontal ? band : value,
        orientation: 'left',
        theme,
        length: space.inner.height,
        tickCount: 5,
        ...(options.yLabel === undefined ? {} : { label: options.yLabel }),
      })
    );

    const showLegend = options.showLegend ?? pivot.seriesKeys.length > 1;
    if (showLegend) {
      layers.push(
        legend('legend', {
          theme,
          x: 0,
          y: -space.margin.top + 4,
          entries: pivot.seriesKeys.map((key) => ({
            key,
            label: key,
            color: colorFor(key),
            muted: state.hiddenSeries.includes(key),
          })),
        })
      );
    }

    return layers;
  };

  const chart = createChart<BarChartState>(container, {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
    ...(options.margin === undefined ? {} : { margin: options.margin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
    initialState: {
      dataset: toDataset(options.data),
      highlight: null,
      hiddenSeries: [],
    },
    layers: [
      (state, context) => group({ key: 'bar-chart' }, build(state, context)),
    ],
  });

  return {
    ...chart,
    setData(data: ChartData): void {
      chart.update({ dataset: toDataset(data) });
    },
    highlight(key: string | null): void {
      chart.update({ highlight: key });
    },
    toggleSeries(key: string): void {
      const hidden = chart.store.get().hiddenSeries;
      chart.update({
        hiddenSeries: hidden.includes(key)
          ? hidden.filter((entry) => entry !== key)
          : [...hidden, key],
      });
    },
  };
}
