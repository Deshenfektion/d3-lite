import { createContinuousScale, identityTransform } from './continuous.ts';
import type { ContinuousScale } from './types.ts';

export interface LinearScaleOptions {
  readonly domain?: readonly number[];
  readonly range?: readonly number[];
  readonly clamp?: boolean;
  readonly nice?: boolean | number;
}

export function scaleLinear(options: LinearScaleOptions = {}): ContinuousScale {
  const scale = createContinuousScale({
    transform: identityTransform,
    ...(options.domain === undefined ? {} : { domain: options.domain }),
    ...(options.range === undefined ? {} : { range: options.range }),
  });
  if (options.clamp) scale.clamp(true);
  if (options.nice) scale.nice(typeof options.nice === 'number' ? options.nice : 10);
  return scale;
}

export function scaleIdentity(): ContinuousScale {
  return createContinuousScale({ domain: [0, 1], range: [0, 1] });
}
