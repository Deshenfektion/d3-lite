import type { Formatter } from '../utils/format.ts';
import type { InterpolatorFactory } from '../interpolate/basis.ts';

export interface Scale<Domain, Range> {
  (value: Domain): Range;
  domain(): Domain[];
  domain(values: Iterable<Domain>): this;
  range(): Range[];
  range(values: Iterable<Range>): this;
  copy(): Scale<Domain, Range>;
}

export interface ContinuousScale extends Scale<number, number> {
  invert(value: number): number;
  clamp(): boolean;
  clamp(value: boolean): this;
  interpolate(): InterpolatorFactory<number>;
  interpolate(factory: InterpolatorFactory<number>): this;
  nice(count?: number): this;
  ticks(count?: number): number[];
  tickFormat(count?: number): Formatter;
  copy(): ContinuousScale;
}

export interface BandScale extends Scale<string, number> {
  bandwidth(): number;
  step(): number;
  padding(): number;
  padding(value: number): this;
  paddingInner(): number;
  paddingInner(value: number): this;
  paddingOuter(): number;
  paddingOuter(value: number): this;
  align(): number;
  align(value: number): this;
  round(): boolean;
  round(value: boolean): this;
  copy(): BandScale;
}

export type ScaleKind =
  | 'linear'
  | 'log'
  | 'pow'
  | 'sqrt'
  | 'time'
  | 'band'
  | 'point'
  | 'ordinal'
  | 'quantize'
  | 'threshold'
  | 'sequential'
  | 'diverging';
