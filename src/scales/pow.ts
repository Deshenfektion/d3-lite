import { sign } from '../utils/math.ts';
import { createContinuousScale, type TransformPair } from './continuous.ts';
import type { ContinuousScale } from './types.ts';

export interface PowScaleOptions {
  readonly domain?: readonly number[];
  readonly range?: readonly number[];
  readonly exponent?: number;
  readonly clamp?: boolean;
}

function powTransform(exponent: number): TransformPair {
  return {
    forward: (value) => sign(value) * Math.abs(value) ** exponent,
    inverse: (value) => sign(value) * Math.abs(value) ** (1 / exponent),
  };
}

export function scalePow(options: PowScaleOptions = {}): ContinuousScale {
  const exponent = options.exponent ?? 1;
  const scale = createContinuousScale({
    transform: powTransform(exponent),
    ...(options.domain === undefined ? {} : { domain: options.domain }),
    ...(options.range === undefined ? {} : { range: options.range }),
  });
  if (options.clamp) scale.clamp(true);

  const baseCopy = scale.copy.bind(scale);
  scale.copy = (): ContinuousScale => {
    const source = baseCopy();
    return scalePow({
      exponent,
      domain: source.domain(),
      range: source.range(),
      clamp: source.clamp(),
    });
  };

  return scale;
}

export function scaleSqrt(
  options: Omit<PowScaleOptions, 'exponent'> = {}
): ContinuousScale {
  return scalePow({ ...options, exponent: 0.5 });
}
