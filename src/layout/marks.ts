import type { Rect } from '../types/geometry.ts';
import type { BandScale, ContinuousScale } from '../scales/types.ts';

export interface BarLayoutOptions {
  readonly band: BandScale;
  readonly value: ContinuousScale;
  readonly baseline?: number;
  readonly horizontal?: boolean;
  readonly minLength?: number;
}

export interface BarRect extends Rect {
  readonly key: string;
  readonly negative: boolean;
}

export function layoutBars(
  entries: readonly { key: string; value: number }[],
  options: BarLayoutOptions
): BarRect[] {
  const baseline = options.baseline ?? 0;
  const zero = options.value(baseline);
  const minLength = options.minLength ?? 0;
  const bandwidth = options.band.bandwidth();

  return entries.map((entry) => {
    const position = options.band(entry.key);
    const projected = options.value(entry.value);
    const negative = entry.value < baseline;

    if (options.horizontal) {
      const left = Math.min(zero, projected);
      const width = Math.max(minLength, Math.abs(projected - zero));
      return {
        key: entry.key,
        x: negative ? left : zero,
        y: position,
        width,
        height: bandwidth,
        negative,
      };
    }

    const top = Math.min(zero, projected);
    const height = Math.max(minLength, Math.abs(projected - zero));
    return {
      key: entry.key,
      x: position,
      y: negative ? zero : top,
      width: bandwidth,
      height,
      negative,
    };
  });
}

export interface GroupedBandOptions {
  readonly band: BandScale;
  readonly seriesCount: number;
  readonly padding?: number;
}

export interface GroupedBand {
  offsetFor(seriesIndex: number): number;
  readonly width: number;
}

export function groupedBand(options: GroupedBandOptions): GroupedBand {
  const count = Math.max(1, options.seriesCount);
  const padding = options.padding ?? 0.08;
  const total = options.band.bandwidth();
  const slot = total / count;
  const width = Math.max(1, slot * (1 - padding));
  const inset = (slot - width) / 2;

  return {
    width,
    offsetFor: (seriesIndex: number) => seriesIndex * slot + inset,
  };
}

export interface SeparatedSegment {
  readonly start: number;
  readonly length: number;
}

export function applySegmentGap(
  start: number,
  end: number,
  gap: number,
  isFirst: boolean,
  isLast: boolean
): SeparatedSegment {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const leading = isFirst ? 0 : gap / 2;
  const trailing = isLast ? 0 : gap / 2;
  const length = Math.max(0, hi - lo - leading - trailing);
  return { start: lo + leading, length };
}
