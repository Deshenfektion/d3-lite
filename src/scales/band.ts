import { clamp } from '../utils/math.ts';
import type { BandScale } from './types.ts';

export interface BandScaleOptions {
  readonly domain?: Iterable<string>;
  readonly range?: readonly [number, number];
  readonly padding?: number;
  readonly paddingInner?: number;
  readonly paddingOuter?: number;
  readonly align?: number;
  readonly round?: boolean;
}

interface BandState {
  domain: string[];
  range: [number, number];
  paddingInner: number;
  paddingOuter: number;
  align: number;
  round: boolean;
}

function buildPositions(state: BandState): {
  positions: Map<string, number>;
  bandwidth: number;
  step: number;
} {
  const n = state.domain.length;
  const [r0, r1] = state.range;
  const reverse = r1 < r0;
  const start = reverse ? r1 : r0;
  const stop = reverse ? r0 : r1;
  const span = stop - start;

  if (n === 0) return { positions: new Map(), bandwidth: 0, step: 0 };

  let step = span / Math.max(1, n - state.paddingInner + state.paddingOuter * 2);
  if (state.round) step = Math.floor(step);

  let bandwidth = step * (1 - state.paddingInner);
  if (state.round) bandwidth = Math.round(bandwidth);

  let offset = start + (span - step * (n - state.paddingInner)) * state.align;
  if (state.round) offset = Math.round(offset);

  const positions = new Map<string, number>();
  const order = reverse ? [...state.domain].reverse() : state.domain;
  order.forEach((key, i) => {
    positions.set(key, offset + step * i);
  });

  return { positions, bandwidth, step };
}

export function scaleBand(options: BandScaleOptions = {}): BandScale {
  const state: BandState = {
    domain: [...(options.domain ?? [])],
    range: options.range ? [options.range[0], options.range[1]] : [0, 1],
    paddingInner: options.paddingInner ?? options.padding ?? 0,
    paddingOuter: options.paddingOuter ?? options.padding ?? 0,
    align: options.align ?? 0.5,
    round: options.round ?? false,
  };

  let computed = buildPositions(state);
  const invalidate = (): void => {
    computed = buildPositions(state);
  };

  const scale = ((value: string): number =>
    computed.positions.get(value) ?? Number.NaN) as BandScale;

  scale.domain = ((values?: Iterable<string>) => {
    if (values === undefined) return [...state.domain];
    const seen = new Set<string>();
    state.domain = [];
    for (const value of values) {
      if (seen.has(value)) continue;
      seen.add(value);
      state.domain.push(value);
    }
    invalidate();
    return scale;
  }) as BandScale['domain'];

  scale.range = ((values?: Iterable<number>) => {
    if (values === undefined) return [...state.range];
    const list = [...values];
    state.range = [list[0] ?? 0, list[1] ?? 0];
    invalidate();
    return scale;
  }) as BandScale['range'];

  scale.bandwidth = (): number => computed.bandwidth;
  scale.step = (): number => computed.step;

  scale.padding = ((value?: number) => {
    if (value === undefined) return state.paddingInner;
    const next = clamp(value, 0, 1);
    state.paddingInner = next;
    state.paddingOuter = next;
    invalidate();
    return scale;
  }) as BandScale['padding'];

  scale.paddingInner = ((value?: number) => {
    if (value === undefined) return state.paddingInner;
    state.paddingInner = clamp(value, 0, 1);
    invalidate();
    return scale;
  }) as BandScale['paddingInner'];

  scale.paddingOuter = ((value?: number) => {
    if (value === undefined) return state.paddingOuter;
    state.paddingOuter = Math.max(0, value);
    invalidate();
    return scale;
  }) as BandScale['paddingOuter'];

  scale.align = ((value?: number) => {
    if (value === undefined) return state.align;
    state.align = clamp(value, 0, 1);
    invalidate();
    return scale;
  }) as BandScale['align'];

  scale.round = ((value?: boolean) => {
    if (value === undefined) return state.round;
    state.round = value;
    invalidate();
    return scale;
  }) as BandScale['round'];

  scale.copy = (): BandScale =>
    scaleBand({
      domain: state.domain,
      range: state.range,
      paddingInner: state.paddingInner,
      paddingOuter: state.paddingOuter,
      align: state.align,
      round: state.round,
    });

  return scale;
}

export function scalePoint(options: Omit<BandScaleOptions, 'paddingInner'> = {}): BandScale {
  return scaleBand({ ...options, paddingInner: 1, paddingOuter: options.padding ?? 0 });
}

export function bandCenter(scale: BandScale, value: string): number {
  return scale(value) + scale.bandwidth() / 2;
}

export function invertBand(scale: BandScale, position: number): string | undefined {
  const domain = scale.domain();
  const step = scale.step();
  if (step === 0) return undefined;
  for (const key of domain) {
    const start = scale(key);
    if (position >= start && position < start + step) return key;
  }
  return undefined;
}
