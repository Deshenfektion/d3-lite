import { formatAuto, type Formatter } from '../utils/format.ts';
import { createContinuousScale, type TransformPair } from './continuous.ts';
import type { ContinuousScale } from './types.ts';

export interface LogScaleOptions {
  readonly domain?: readonly number[];
  readonly range?: readonly number[];
  readonly base?: number;
  readonly clamp?: boolean;
}

function logTransform(base: number, negative: boolean): TransformPair {
  const logBase = Math.log(base);
  return negative
    ? {
        forward: (value) => -Math.log(-value) / logBase,
        inverse: (value) => -Math.exp(-value * logBase),
      }
    : {
        forward: (value) => Math.log(value) / logBase,
        inverse: (value) => Math.exp(value * logBase),
      };
}

export function scaleLog(options: LogScaleOptions = {}): ContinuousScale {
  const base = options.base ?? 10;
  const domain = options.domain ?? [1, 10];
  const negative = (domain[0] as number) < 0;
  const transform = logTransform(base, negative);

  const scale = createContinuousScale({
    transform,
    domain,
    ...(options.range === undefined ? {} : { range: options.range }),
  });
  if (options.clamp) scale.clamp(true);

  const baseTicks = scale.ticks.bind(scale);
  const baseFormat = scale.tickFormat.bind(scale);
  const baseNice = scale.nice.bind(scale);
  const baseCopy = scale.copy.bind(scale);

  scale.ticks = (count = 10): number[] => {
    const domainValues = scale.domain();
    let lo = domainValues[0] as number;
    let hi = domainValues[domainValues.length - 1] as number;
    const reverse = hi < lo;
    if (reverse) [lo, hi] = [hi, lo];

    if (!(lo > 0) || !Number.isFinite(lo) || !Number.isFinite(hi)) return baseTicks(count);

    const start = Math.floor(transform.forward(lo));
    const stop = Math.ceil(transform.forward(hi));
    const out: number[] = [];

    if (base % 1 === 0 && stop - start < count) {
      for (let exponent = start; exponent <= stop; exponent++) {
        for (let factor = 1; factor < base; factor++) {
          const value = factor * base ** exponent;
          if (value < lo) continue;
          if (value > hi) break;
          out.push(value);
        }
      }
    } else {
      const step = Math.max(1, Math.round((stop - start) / count));
      for (let exponent = start; exponent <= stop; exponent += step) {
        const value = base ** exponent;
        if (value >= lo && value <= hi) out.push(value);
      }
    }

    return reverse ? out.reverse() : out;
  };

  scale.tickFormat = (count = 10): Formatter => {
    const values = scale.ticks(count);
    if (values.length === 0) return baseFormat(count);
    const smallest = Math.min(...values.map((value) => Math.abs(value)));
    return formatAuto(smallest);
  };

  scale.nice = (): ContinuousScale => {
    const domainValues = scale.domain();
    const lo = domainValues[0] as number;
    const hi = domainValues[domainValues.length - 1] as number;
    if (!(lo > 0) || !(hi > 0)) return baseNice();
    const flipped = hi < lo;
    const [low, high] = flipped ? [hi, lo] : [lo, hi];
    const nextLow = base ** Math.floor(transform.forward(low));
    const nextHigh = base ** Math.ceil(transform.forward(high));
    scale.domain(flipped ? [nextHigh, nextLow] : [nextLow, nextHigh]);
    return scale;
  };

  scale.copy = (): ContinuousScale => {
    const source = baseCopy();
    const next = scaleLog({
      base,
      domain: source.domain(),
      range: source.range(),
      clamp: source.clamp(),
    });
    return next;
  };

  return scale;
}
