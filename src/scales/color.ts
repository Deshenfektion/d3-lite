import { rampInterpolator, type ColorSpace } from '../color/interpolate.ts';
import { categoricalSlots, sequentialBlue, type ThemeMode } from '../color/schemes.ts';
import type { Interpolator } from '../interpolate/basis.ts';
import { clamp } from '../utils/math.ts';
import { scaleOrdinal, type OrdinalScale } from './ordinal.ts';

export interface SequentialColorScale {
  (value: number): string;
  domain(): [number, number];
  domain(values: readonly number[]): this;
  interpolator(): Interpolator<string>;
  interpolator(fn: Interpolator<string>): this;
  clamp(): boolean;
  clamp(value: boolean): this;
  copy(): SequentialColorScale;
}

export interface SequentialColorOptions {
  readonly domain?: readonly number[];
  readonly colors?: readonly string[];
  readonly space?: ColorSpace;
  readonly clamp?: boolean;
}

export function scaleSequentialColor(
  options: SequentialColorOptions = {}
): SequentialColorScale {
  let d0 = options.domain?.[0] ?? 0;
  let d1 = options.domain?.[1] ?? 1;
  let clampEnabled = options.clamp ?? true;
  let interpolate = rampInterpolator(options.colors ?? sequentialBlue, options.space ?? 'lab');

  const scale = ((value: number): string => {
    const span = d1 - d0;
    const t = span === 0 ? 0.5 : (value - d0) / span;
    return interpolate(clampEnabled ? clamp(t, 0, 1) : t);
  }) as SequentialColorScale;

  scale.domain = ((values?: readonly number[]) => {
    if (values === undefined) return [d0, d1];
    d0 = values[0] ?? 0;
    d1 = values[1] ?? 1;
    return scale;
  }) as SequentialColorScale['domain'];

  scale.interpolator = ((fn?: Interpolator<string>) => {
    if (fn === undefined) return interpolate;
    interpolate = fn;
    return scale;
  }) as SequentialColorScale['interpolator'];

  scale.clamp = ((value?: boolean) => {
    if (value === undefined) return clampEnabled;
    clampEnabled = value;
    return scale;
  }) as SequentialColorScale['clamp'];

  scale.copy = (): SequentialColorScale => {
    const next = scaleSequentialColor({ domain: [d0, d1], clamp: clampEnabled });
    next.interpolator(interpolate);
    return next;
  };

  return scale;
}

export interface DivergingColorOptions {
  readonly domain?: readonly [number, number, number];
  readonly colors?: readonly string[];
  readonly space?: ColorSpace;
}

export function scaleDivergingColor(options: DivergingColorOptions): SequentialColorScale {
  const [lo, mid, hi] = options.domain ?? [-1, 0, 1];
  const colors = options.colors ?? [];
  const half = Math.floor(colors.length / 2);
  const lowRamp = rampInterpolator(colors.slice(0, half + 1), options.space ?? 'lab');
  const highRamp = rampInterpolator(colors.slice(half), options.space ?? 'lab');

  const base = scaleSequentialColor({ domain: [lo, hi] });
  base.interpolator((t) => {
    const value = lo + (hi - lo) * t;
    if (value <= mid) {
      const span = mid - lo;
      return lowRamp(span === 0 ? 1 : clamp((value - lo) / span, 0, 1));
    }
    const span = hi - mid;
    return highRamp(span === 0 ? 0 : clamp((value - mid) / span, 0, 1));
  });

  return base;
}

export interface CategoricalColorOptions {
  readonly domain?: Iterable<string>;
  readonly mode?: ThemeMode;
  readonly colors?: readonly string[];
  readonly unknown?: string;
}

export function scaleCategoricalColor(
  options: CategoricalColorOptions = {}
): OrdinalScale<string> {
  const domain = [...(options.domain ?? [])];
  const colors = options.colors ?? categoricalSlots(Math.max(1, domain.length), options.mode);
  return scaleOrdinal<string>({
    domain,
    range: colors,
    ...(options.unknown === undefined ? {} : { unknown: options.unknown }),
  });
}
