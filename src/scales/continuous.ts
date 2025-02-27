import { bisectRight } from '../utils/array.ts';
import { formatAuto, type Formatter } from '../utils/format.ts';
import { clamp as clampValue, niceDomain, ticks as generateTicks, tickStep } from '../utils/math.ts';
import { interpolateNumber, type InterpolatorFactory } from '../interpolate/basis.ts';
import type { ContinuousScale } from './types.ts';

export interface TransformPair {
  readonly forward: (value: number) => number;
  readonly inverse: (value: number) => number;
}

export const identityTransform: TransformPair = {
  forward: (value) => value,
  inverse: (value) => value,
};

function normalizeSegment(a: number, b: number): (value: number) => number {
  const span = b - a;
  return span === 0 || Number.isNaN(span) ? () => 0.5 : (value) => (value - a) / span;
}

function bimap(
  domain: readonly number[],
  range: readonly number[],
  factory: InterpolatorFactory<number>
): (value: number) => number {
  const d0 = domain[0] as number;
  const d1 = domain[1] as number;
  const r0 = range[0] as number;
  const r1 = range[1] as number;
  const deinterpolate = normalizeSegment(d0, d1);
  const reinterpolate = factory(r0, r1);
  return (value) => reinterpolate(deinterpolate(value));
}

function polymap(
  domain: readonly number[],
  range: readonly number[],
  factory: InterpolatorFactory<number>
): (value: number) => number {
  const n = Math.min(domain.length, range.length) - 1;
  const ascending = (domain[0] as number) < (domain[n] as number);
  const keys = ascending ? domain.slice(0, n + 1) : domain.slice(0, n + 1).reverse();
  const values = ascending ? range.slice(0, n + 1) : range.slice(0, n + 1).reverse();

  const deinterpolators: ((value: number) => number)[] = [];
  const reinterpolators: ((t: number) => number)[] = [];
  for (let i = 0; i < n; i++) {
    deinterpolators.push(normalizeSegment(keys[i] as number, keys[i + 1] as number));
    reinterpolators.push(factory(values[i] as number, values[i + 1] as number));
  }

  const thresholds = keys.slice(1, n) as number[];

  return (value) => {
    const index = clampValue(bisectRight(thresholds, value), 0, n - 1);
    return (reinterpolators[index] as (t: number) => number)(
      (deinterpolators[index] as (value: number) => number)(value)
    );
  };
}

export interface ContinuousOptions {
  readonly transform?: TransformPair;
  readonly domain?: readonly number[];
  readonly range?: readonly number[];
}

export function createContinuousScale(options: ContinuousOptions = {}): ContinuousScale {
  const transform = options.transform ?? identityTransform;
  let domainValues: number[] = [...(options.domain ?? [0, 1])];
  let rangeValues: number[] = [...(options.range ?? [0, 1])];
  let clampEnabled = false;
  let interpolatorFactory: InterpolatorFactory<number> = interpolateNumber;

  let forwardFn: ((value: number) => number) | undefined;
  let inverseFn: ((value: number) => number) | undefined;

  const invalidate = (): void => {
    forwardFn = undefined;
    inverseFn = undefined;
  };

  const buildForward = (): ((value: number) => number) => {
    const transformed = domainValues.map(transform.forward);
    const map = Math.min(transformed.length, rangeValues.length) > 2 ? polymap : bimap;
    return map(transformed, rangeValues, interpolatorFactory);
  };

  const buildInverse = (): ((value: number) => number) => {
    const transformed = domainValues.map(transform.forward);
    const map = Math.min(transformed.length, rangeValues.length) > 2 ? polymap : bimap;
    return map(rangeValues, transformed, interpolateNumber);
  };

  const domainBounds = (): [number, number] => {
    const first = domainValues[0] as number;
    const lastValue = domainValues[domainValues.length - 1] as number;
    return first <= lastValue ? [first, lastValue] : [lastValue, first];
  };

  const scale = ((value: number): number => {
    if (Number.isNaN(value)) return Number.NaN;
    forwardFn ??= buildForward();
    if (clampEnabled) {
      const [lo, hi] = domainBounds();
      return forwardFn(transform.forward(clampValue(value, lo, hi)));
    }
    return forwardFn(transform.forward(value));
  }) as ContinuousScale;

  scale.domain = ((values?: Iterable<number>) => {
    if (values === undefined) return [...domainValues];
    domainValues = [...values];
    invalidate();
    return scale;
  }) as ContinuousScale['domain'];

  scale.range = ((values?: Iterable<number>) => {
    if (values === undefined) return [...rangeValues];
    rangeValues = [...values];
    invalidate();
    return scale;
  }) as ContinuousScale['range'];

  scale.clamp = ((value?: boolean) => {
    if (value === undefined) return clampEnabled;
    clampEnabled = value;
    return scale;
  }) as ContinuousScale['clamp'];

  scale.interpolate = ((factory?: InterpolatorFactory<number>) => {
    if (factory === undefined) return interpolatorFactory;
    interpolatorFactory = factory;
    invalidate();
    return scale;
  }) as ContinuousScale['interpolate'];

  scale.invert = (value: number): number => {
    inverseFn ??= buildInverse();
    const result = transform.inverse(inverseFn(value));
    if (!clampEnabled) return result;
    const [lo, hi] = domainBounds();
    return clampValue(result, lo, hi);
  };

  scale.nice = (count = 10): ContinuousScale => {
    const first = domainValues[0] as number;
    const lastValue = domainValues[domainValues.length - 1] as number;
    const [lo, hi] = niceDomain(
      transform.forward(first),
      transform.forward(lastValue),
      count
    );
    domainValues = [
      transform.inverse(lo),
      ...domainValues.slice(1, -1),
      transform.inverse(hi),
    ];
    invalidate();
    return scale;
  };

  scale.ticks = (count = 10): number[] => {
    const first = domainValues[0] as number;
    const lastValue = domainValues[domainValues.length - 1] as number;
    return generateTicks(first, lastValue, count);
  };

  scale.tickFormat = (count = 10): Formatter => {
    const first = domainValues[0] as number;
    const lastValue = domainValues[domainValues.length - 1] as number;
    return formatAuto(tickStep(first, lastValue, count));
  };

  scale.copy = (): ContinuousScale => {
    const next = createContinuousScale({ transform, domain: domainValues, range: rangeValues });
    next.clamp(clampEnabled);
    next.interpolate(interpolatorFactory);
    return next;
  };

  return scale;
}
