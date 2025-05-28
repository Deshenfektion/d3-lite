import type { Theme } from '../color/schemes.ts';
import { group, path, rect, text, type SceneNode } from '../renderer/scene.ts';
import { roundedRectPath } from '../shape/path.ts';
import { truncate } from '../utils/format.ts';

export interface LegendEntry {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly muted?: boolean;
}

export interface LegendOptions {
  readonly entries: readonly LegendEntry[];
  readonly theme: Theme;
  readonly x?: number;
  readonly y?: number;
  readonly itemWidth?: number;
  readonly swatchSize?: number;
  readonly gap?: number;
  readonly columns?: number;
}

export function legend(key: string, options: LegendOptions): SceneNode {
  const swatch = options.swatchSize ?? 10;
  const gap = options.gap ?? 6;
  const itemWidth = options.itemWidth ?? 110;
  const columns = options.columns ?? options.entries.length;
  const children: SceneNode[] = [];

  options.entries.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * itemWidth;
    const y = row * (swatch + gap + 6);
    const opacity = entry.muted ? 0.35 : 1;

    children.push(
      path(`${key}-swatch-${entry.key}`, {
        d: roundedRectPath(x, y, swatch, swatch, [2, 2, 2, 2]),
        fill: entry.color,
        'fill-opacity': opacity,
      })
    );

    children.push(
      text(`${key}-label-${entry.key}`, truncate(entry.label, 20), {
        x: x + swatch + gap,
        y: y + swatch - 1,
        fill: entry.muted ? options.theme.textMuted : options.theme.textSecondary,
        'font-size': 12,
      })
    );
  });

  return group({ key, transform: { x: options.x ?? 0, y: options.y ?? 0, k: 1 } }, children);
}

export interface ValueLabelOptions {
  readonly entries: readonly { key: string; x: number; y: number; label: string }[];
  readonly theme: Theme;
  readonly anchor?: 'middle' | 'start' | 'end';
  readonly dy?: number;
}

export function valueLabels(key: string, options: ValueLabelOptions): SceneNode {
  const children = options.entries.map((entry) =>
    text(`${key}-${entry.key}`, entry.label, {
      x: entry.x,
      y: entry.y + (options.dy ?? -6),
      fill: options.theme.textSecondary,
      'font-size': 11,
      'text-anchor': options.anchor ?? 'middle',
      'font-variant-numeric': 'tabular-nums',
    })
  );
  return group({ key }, children);
}

export interface PlotFrameOptions {
  readonly theme: Theme;
  readonly width: number;
  readonly height: number;
}

export function plotBackground(key: string, options: PlotFrameOptions): SceneNode {
  return rect(key, {
    x: 0,
    y: 0,
    width: options.width,
    height: options.height,
    fill: 'transparent',
    'pointer-events': 'all',
  });
}
