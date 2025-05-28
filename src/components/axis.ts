import type { Orientation } from '../types/geometry.ts';
import type { Theme } from '../color/schemes.ts';
import type { BandScale, ContinuousScale } from '../scales/types.ts';
import { group, line, text, type SceneNode } from '../renderer/scene.ts';
import { truncate } from '../utils/format.ts';

export type AxisScale = ContinuousScale | BandScale;

export function isBandScale(scale: AxisScale): scale is BandScale {
  return typeof (scale as BandScale).bandwidth === 'function';
}

export interface AxisOptions {
  readonly scale: AxisScale;
  readonly orientation: Orientation;
  readonly theme: Theme;
  readonly tickCount?: number;
  readonly format?: (value: never) => string;
  readonly tickSize?: number;
  readonly tickPadding?: number;
  readonly label?: string;
  readonly labelOffset?: number;
  readonly maxLabelLength?: number;
  readonly showDomain?: boolean;
  readonly length?: number;
}

interface Tick {
  readonly key: string;
  readonly position: number;
  readonly label: string;
}

function collectTicks(options: AxisOptions): Tick[] {
  const { scale } = options;

  if (isBandScale(scale)) {
    const half = scale.bandwidth() / 2;
    return scale.domain().map((value) => ({
      key: value,
      position: scale(value) + half,
      label: value,
    }));
  }

  const count = options.tickCount ?? 6;
  const values = scale.ticks(count);
  const format =
    (options.format as ((value: number) => string) | undefined) ?? scale.tickFormat(count);
  return values.map((value) => ({
    key: String(value),
    position: scale(value),
    label: format(value),
  }));
}

export function axis(key: string, options: AxisOptions): SceneNode {
  const { orientation, theme } = options;
  const tickSize = options.tickSize ?? 4;
  const tickPadding = options.tickPadding ?? 6;
  const maxLabelLength = options.maxLabelLength ?? 18;
  const horizontal = orientation === 'top' || orientation === 'bottom';
  const sign = orientation === 'top' || orientation === 'left' ? -1 : 1;
  const ticks = collectTicks(options);

  const children: SceneNode[] = [];

  if (options.showDomain !== false && options.length !== undefined) {
    children.push(
      line(`${key}-domain`, {
        x1: 0,
        y1: 0,
        x2: horizontal ? options.length : 0,
        y2: horizontal ? 0 : options.length,
        stroke: theme.axis,
        'stroke-width': 1,
      })
    );
  }

  for (const tick of ticks) {
    const x = horizontal ? tick.position : 0;
    const y = horizontal ? 0 : tick.position;

    children.push(
      line(`${key}-tick-${tick.key}`, {
        x1: x,
        y1: y,
        x2: horizontal ? x : sign * tickSize,
        y2: horizontal ? sign * tickSize : y,
        stroke: theme.axis,
        'stroke-width': 1,
      })
    );

    children.push(
      text(`${key}-label-${tick.key}`, truncate(tick.label, maxLabelLength), {
        x: horizontal ? x : sign * (tickSize + tickPadding),
        y: horizontal ? sign * (tickSize + tickPadding) : y,
        fill: theme.textMuted,
        'font-size': 11,
        'text-anchor': horizontal ? 'middle' : sign < 0 ? 'end' : 'start',
        'dominant-baseline': horizontal ? (sign < 0 ? 'auto' : 'hanging') : 'middle',
      })
    );
  }

  if (options.label) {
    const offset = options.labelOffset ?? (horizontal ? 34 : 38);
    const mid = (options.length ?? 0) / 2;
    children.push(
      text(`${key}-title`, options.label, {
        x: horizontal ? mid : sign * offset,
        y: horizontal ? sign * offset : mid,
        fill: theme.textSecondary,
        'font-size': 12,
        'text-anchor': 'middle',
        ...(horizontal ? {} : { transform: `rotate(-90, ${sign * offset}, ${mid})` }),
      })
    );
  }

  return group({ key }, children);
}

export interface GridOptions {
  readonly scale: AxisScale;
  readonly theme: Theme;
  readonly orientation: 'horizontal' | 'vertical';
  readonly length: number;
  readonly tickCount?: number;
}

export function grid(key: string, options: GridOptions): SceneNode {
  const { scale } = options;
  const positions: { key: string; position: number }[] = isBandScale(scale)
    ? scale.domain().map((value) => ({
        key: value,
        position: scale(value) + scale.bandwidth() / 2,
      }))
    : scale.ticks(options.tickCount ?? 6).map((value) => ({
        key: String(value),
        position: scale(value),
      }));

  const children = positions.map((entry) =>
    line(`${key}-${entry.key}`, {
      x1: options.orientation === 'horizontal' ? 0 : entry.position,
      y1: options.orientation === 'horizontal' ? entry.position : 0,
      x2: options.orientation === 'horizontal' ? options.length : entry.position,
      y2: options.orientation === 'horizontal' ? entry.position : options.length,
      stroke: options.theme.gridline,
      'stroke-width': 1,
      'shape-rendering': 'crispEdges',
    })
  );

  return group({ key }, children);
}
