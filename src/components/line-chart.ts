import type { Dataset, Row } from '../types/data.ts';
import type { Point } from '../types/geometry.ts';
import { categoricalSlots } from '../color/schemes.ts';
import { scaleLinear } from '../scales/linear.ts';
import { scaleTime, type TimeScale } from '../scales/time.ts';
import type { ContinuousScale } from '../scales/types.ts';
import { formatAuto } from '../utils/format.ts';
import { toNumber, toStringKey } from '../utils/guards.ts';
import { group, type SceneNode } from '../renderer/scene.ts';
import type { CurveKind } from '../shape/curves.ts';
import { axis, grid } from './axis.ts';
import { legend, plotBackground } from './legend.ts';
import { areaMark, lineMark, pointMarks } from './marks.ts';
import { createChart, type Chart, type ChartContext } from './chart.ts';
import { toDataset, type BaseChartOptions, type ChartData } from './common.ts';

export interface LineChartOptions extends BaseChartOptions {
  readonly data: ChartData;
  readonly x: string;
  readonly y: string;
  readonly series?: string;
  readonly curve?: CurveKind;
  readonly temporal?: boolean;
  readonly area?: boolean;
  readonly showPoints?: boolean;
  readonly zeroBaseline?: boolean;
}

export interface LineChartState {
  readonly dataset: Dataset;
  readonly hiddenSeries: readonly string[];
  readonly focusIndex: number | null;
}

export type LineChart = Chart<LineChartState> & {
  setData(data: ChartData): void;
  toggleSeries(key: string): void;
  focus(index: number | null): void;
};

interface SeriesGroup {
  readonly key: string;
  readonly rows: Row[];
}

function groupSeries(rows: readonly Row[], seriesField: string | undefined): SeriesGroup[] {
  if (!seriesField) return [{ key: 'series', rows: [...rows] }];
  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const key = toStringKey(row[seriesField] ?? null);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  return [...buckets].map(([key, bucketRows]) => ({ key, rows: bucketRows }));
}

export function lineChart(container: Element, options: LineChartOptions): LineChart {
  const curve = options.curve ?? 'monotoneX';
  const format = options.valueFormat ?? formatAuto(1);

  const build = (state: LineChartState, context: ChartContext): SceneNode[] => {
    const { space, theme } = context;
    const rows = state.dataset.rows;
    const groups = groupSeries(rows, options.series);
    const visible = groups.filter((entry) => !state.hiddenSeries.includes(entry.key));
    const palette = categoricalSlots(groups.length, theme.mode);
    const colorFor = (key: string): string => {
      const index = groups.findIndex((entry) => entry.key === key);
      return palette[Math.max(0, index) % palette.length] ?? theme.textPrimary;
    };

    let xLo = Number.POSITIVE_INFINITY;
    let xHi = Number.NEGATIVE_INFINITY;
    let yLo = Number.POSITIVE_INFINITY;
    let yHi = Number.NEGATIVE_INFINITY;

    for (const entry of visible) {
      for (const row of entry.rows) {
        const xv = toNumber(row[options.x] ?? null);
        const yv = toNumber(row[options.y] ?? null);
        if (!Number.isNaN(xv)) {
          if (xv < xLo) xLo = xv;
          if (xv > xHi) xHi = xv;
        }
        if (!Number.isNaN(yv)) {
          if (yv < yLo) yLo = yv;
          if (yv > yHi) yHi = yv;
        }
      }
    }

    if (!Number.isFinite(xLo)) {
      xLo = 0;
      xHi = 1;
    }
    if (!Number.isFinite(yLo)) {
      yLo = 0;
      yHi = 1;
    }
    if (options.zeroBaseline !== false) yLo = Math.min(0, yLo);

    const xScale: ContinuousScale | TimeScale = options.temporal
      ? scaleTime({ domain: [xLo, xHi], range: [0, space.inner.width] })
      : scaleLinear({ domain: [xLo, xHi], range: [0, space.inner.width] });

    const yScale = scaleLinear({
      domain: [yLo, yHi],
      range: [space.inner.height, 0],
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
          scale: yScale,
          theme,
          orientation: 'horizontal',
          length: space.inner.width,
          tickCount: 5,
        })
      );
    }

    const seriesNodes: SceneNode[] = [];

    for (const entry of visible) {
      const points: Point[] = entry.rows.map((row) => ({
        x: xScale(toNumber(row[options.x] ?? null)),
        y: yScale(toNumber(row[options.y] ?? null)),
      }));

      if (options.area) {
        seriesNodes.push(
          areaMark(`area-${entry.key}`, {
            points,
            baseline: yScale(Math.max(0, yLo)),
            color: colorFor(entry.key),
            curve,
          })
        );
      }

      seriesNodes.push(
        lineMark(`line-${entry.key}`, {
          points,
          color: colorFor(entry.key),
          curve,
        })
      );

      if (options.showPoints) {
        seriesNodes.push(
          pointMarks(`dots-${entry.key}`, {
            theme,
            color: colorFor(entry.key),
            radius: 4,
            points: points.map((point, index) => ({
              ...point,
              key: String(index),
              datum: entry.rows[index],
            })),
          })
        );
      }
    }

    layers.push(group({ key: 'series' }, seriesNodes));

    layers.push(
      axis('axis-x', {
        scale: xScale,
        orientation: 'bottom',
        theme,
        length: space.inner.width,
        tickCount: 6,
        ...(options.temporal
          ? { format: (xScale as TimeScale).timeFormat(6) as (value: never) => string }
          : {}),
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

    const showLegend = options.showLegend ?? groups.length > 1;
    if (showLegend) {
      layers.push(
        legend('legend', {
          theme,
          x: 0,
          y: -space.margin.top + 4,
          entries: groups.map((entry) => ({
            key: entry.key,
            label: entry.key,
            color: colorFor(entry.key),
            muted: state.hiddenSeries.includes(entry.key),
          })),
        })
      );
    }

    return layers;
  };

  const chart = createChart<LineChartState>(container, {
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
    ...(options.margin === undefined ? {} : { margin: options.margin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.theme === undefined ? {} : { theme: options.theme }),
    ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
    initialState: {
      dataset: toDataset(options.data),
      hiddenSeries: [],
      focusIndex: null,
    },
    layers: [(state, context) => group({ key: 'line-chart' }, build(state, context))],
  });

  return {
    ...chart,
    setData(data: ChartData): void {
      chart.update({ dataset: toDataset(data) });
    },
    toggleSeries(key: string): void {
      const hidden = chart.store.get().hiddenSeries;
      chart.update({
        hiddenSeries: hidden.includes(key)
          ? hidden.filter((entry) => entry !== key)
          : [...hidden, key],
      });
    },
    focus(index: number | null): void {
      chart.update({ focusIndex: index });
    },
  };
}
