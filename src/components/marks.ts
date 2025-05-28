import type { Theme } from '../color/schemes.ts';
import type { BandScale, ContinuousScale } from '../scales/types.ts';
import { group, path, circle, type SceneNode } from '../renderer/scene.ts';
import { roundedRectPath } from '../shape/path.ts';
import { symbolPath, type SymbolKind } from '../shape/symbol.ts';
import { areaPath, linePath, type LineOptions } from '../shape/line.ts';
import { applySegmentGap, groupedBand, layoutBars } from '../layout/marks.ts';
import type { Point } from '../types/geometry.ts';
import type { StackSeries } from '../layout/stack.ts';

export const MARK_RADIUS = 4;
export const SEGMENT_GAP = 2;
export const MIN_MARKER_SIZE = 8;

export interface BarMarkOptions {
  readonly entries: readonly { key: string; value: number; label?: string }[];
  readonly band: BandScale;
  readonly value: ContinuousScale;
  readonly color: string | ((key: string, index: number) => string);
  readonly horizontal?: boolean;
  readonly baseline?: number;
  readonly radius?: number;
  readonly opacity?: number | ((key: string) => number);
}

function resolveColor(color: BarMarkOptions['color'], key: string, index: number): string {
  return typeof color === 'function' ? color(key, index) : color;
}

export function barMarks(key: string, options: BarMarkOptions): SceneNode {
  const radius = options.radius ?? MARK_RADIUS;
  const rects = layoutBars(options.entries, {
    band: options.band,
    value: options.value,
    ...(options.horizontal === undefined ? {} : { horizontal: options.horizontal }),
    ...(options.baseline === undefined ? {} : { baseline: options.baseline }),
  });

  const children = rects.map((rect, index) => {
    const corners: [number, number, number, number] = options.horizontal
      ? rect.negative
        ? [radius, 0, 0, radius]
        : [0, radius, radius, 0]
      : rect.negative
        ? [0, 0, radius, radius]
        : [radius, radius, 0, 0];

    const opacity =
      typeof options.opacity === 'function' ? options.opacity(rect.key) : options.opacity;

    return path(
      `${key}-${rect.key}`,
      {
        d: roundedRectPath(rect.x, rect.y, rect.width, rect.height, corners),
        fill: resolveColor(options.color, rect.key, index),
        ...(opacity === undefined ? {} : { 'fill-opacity': opacity }),
      },
      options.entries[index]
    );
  });

  return group({ key }, children);
}

export interface StackedBarOptions {
  readonly series: readonly StackSeries[];
  readonly band: BandScale;
  readonly value: ContinuousScale;
  readonly categories: readonly string[];
  readonly color: (seriesKey: string, index: number) => string;
  readonly radius?: number;
  readonly gap?: number;
}

export function stackedBarMarks(key: string, options: StackedBarOptions): SceneNode {
  const radius = options.radius ?? MARK_RADIUS;
  const gap = options.gap ?? SEGMENT_GAP;
  const bandwidth = options.band.bandwidth();
  const children: SceneNode[] = [];
  const lastIndex = options.series.length - 1;

  options.series.forEach((points, seriesIndex) => {
    const seriesKey = points[0]?.key ?? String(seriesIndex);
    const fill = options.color(seriesKey, seriesIndex);

    points.forEach((point) => {
      const category = options.categories[point.index];
      if (category === undefined) return;
      const x = options.band(category);
      if (Number.isNaN(x)) return;

      const top = options.value(point.end);
      const bottom = options.value(point.start);
      const segment = applySegmentGap(
        top,
        bottom,
        gap,
        seriesIndex === lastIndex,
        seriesIndex === 0
      );
      if (segment.length <= 0) return;

      const corners: [number, number, number, number] =
        seriesIndex === lastIndex ? [radius, radius, 0, 0] : [0, 0, 0, 0];

      children.push(
        path(
          `${key}-${seriesKey}-${category}`,
          {
            d: roundedRectPath(x, segment.start, bandwidth, segment.length, corners),
            fill,
          },
          point
        )
      );
    });
  });

  return group({ key }, children);
}

export interface GroupedBarOptions {
  readonly categories: readonly string[];
  readonly seriesKeys: readonly string[];
  readonly valueOf: (category: string, seriesKey: string) => number;
  readonly band: BandScale;
  readonly value: ContinuousScale;
  readonly color: (seriesKey: string, index: number) => string;
  readonly radius?: number;
}

export function groupedBarMarks(key: string, options: GroupedBarOptions): SceneNode {
  const radius = options.radius ?? MARK_RADIUS;
  const slots = groupedBand({ band: options.band, seriesCount: options.seriesKeys.length });
  const zero = options.value(0);
  const children: SceneNode[] = [];

  for (const category of options.categories) {
    const base = options.band(category);
    if (Number.isNaN(base)) continue;

    options.seriesKeys.forEach((seriesKey, seriesIndex) => {
      const raw = options.valueOf(category, seriesKey);
      if (!Number.isFinite(raw)) return;
      const projected = options.value(raw);
      const top = Math.min(zero, projected);
      const height = Math.abs(projected - zero);
      const corners: [number, number, number, number] =
        raw < 0 ? [0, 0, radius, radius] : [radius, radius, 0, 0];

      children.push(
        path(
          `${key}-${category}-${seriesKey}`,
          {
            d: roundedRectPath(
              base + slots.offsetFor(seriesIndex),
              top,
              slots.width,
              height,
              corners
            ),
            fill: options.color(seriesKey, seriesIndex),
          },
          { category, seriesKey, value: raw }
        )
      );
    });
  }

  return group({ key }, children);
}

export interface LineMarkOptions extends LineOptions {
  readonly points: readonly Point[];
  readonly color: string;
  readonly width?: number;
  readonly dashed?: boolean;
}

export function lineMark(key: string, options: LineMarkOptions): SceneNode {
  const { points, color, width, dashed, ...lineOptions } = options;
  return path(key, {
    d: linePath(points, lineOptions),
    fill: 'none',
    stroke: color,
    'stroke-width': width ?? 2,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
    ...(dashed ? { 'stroke-dasharray': '4 4' } : {}),
  });
}

export interface AreaMarkOptions extends LineOptions {
  readonly points: readonly Point[];
  readonly baseline: readonly Point[] | number;
  readonly color: string;
  readonly opacity?: number;
}

export function areaMark(key: string, options: AreaMarkOptions): SceneNode {
  const { points, baseline, color, opacity, ...lineOptions } = options;
  return path(key, {
    d: areaPath(points, baseline, lineOptions),
    fill: color,
    'fill-opacity': opacity ?? 0.18,
    stroke: 'none',
  });
}

export interface PointMarkOptions {
  readonly points: readonly (Point & { key: string; datum?: unknown })[];
  readonly color: string | ((key: string, index: number) => string);
  readonly radius?: number | ((key: string, index: number) => number);
  readonly symbol?: SymbolKind;
  readonly theme: Theme;
  readonly ring?: boolean;
  readonly opacity?: number;
}

export function pointMarks(key: string, options: PointMarkOptions): SceneNode {
  const symbol = options.symbol ?? 'circle';
  const children = options.points.map((point, index) => {
    const fill = resolveColor(options.color, point.key, index);
    const radius =
      typeof options.radius === 'function'
        ? options.radius(point.key, index)
        : (options.radius ?? MIN_MARKER_SIZE / 2);

    const shared = {
      fill,
      ...(options.opacity === undefined ? {} : { 'fill-opacity': options.opacity }),
      ...(options.ring === false ? {} : { stroke: options.theme.surface, 'stroke-width': 2 }),
    };

    if (symbol === 'circle') {
      return circle(
        `${key}-${point.key}`,
        { cx: point.x, cy: point.y, r: radius, ...shared },
        point.datum
      );
    }

    return path(
      `${key}-${point.key}`,
      {
        d: symbolPath(symbol, Math.PI * radius * radius),
        transform: `translate(${point.x}, ${point.y})`,
        ...shared,
      },
      point.datum
    );
  });

  return group({ key }, children);
}
