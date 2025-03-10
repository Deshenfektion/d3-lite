import { bisectRight } from '../utils/array.ts';
import { clamp } from '../utils/math.ts';

export interface QuantizeScale<Range> {
  (value: number): Range;
  domain(): [number, number];
  domain(values: readonly number[]): this;
  range(): Range[];
  range(values: Iterable<Range>): this;
  thresholds(): number[];
  invertExtent(value: Range): [number, number] | undefined;
  copy(): QuantizeScale<Range>;
}

export function scaleQuantize<Range>(options: {
  domain?: readonly number[];
  range?: Iterable<Range>;
}): QuantizeScale<Range> {
  let d0 = options.domain?.[0] ?? 0;
  let d1 = options.domain?.[1] ?? 1;
  let rangeValues: Range[] = [...(options.range ?? [])];

  const scale = ((value: number): Range => {
    const n = rangeValues.length;
    if (n === 0) return undefined as Range;
    if (Number.isNaN(value)) return rangeValues[0] as Range;
    const span = d1 - d0;
    const t = span === 0 ? 0 : (value - d0) / span;
    return rangeValues[clamp(Math.floor(t * n), 0, n - 1)] as Range;
  }) as QuantizeScale<Range>;

  scale.domain = ((values?: readonly number[]) => {
    if (values === undefined) return [d0, d1];
    d0 = values[0] ?? 0;
    d1 = values[1] ?? 1;
    return scale;
  }) as QuantizeScale<Range>['domain'];

  scale.range = ((values?: Iterable<Range>) => {
    if (values === undefined) return [...rangeValues];
    rangeValues = [...values];
    return scale;
  }) as QuantizeScale<Range>['range'];

  scale.thresholds = (): number[] => {
    const n = rangeValues.length;
    const out: number[] = [];
    for (let i = 1; i < n; i++) out.push(d0 + ((d1 - d0) * i) / n);
    return out;
  };

  scale.invertExtent = (value: Range): [number, number] | undefined => {
    const index = rangeValues.indexOf(value);
    if (index < 0) return undefined;
    const n = rangeValues.length;
    const step = (d1 - d0) / n;
    return [d0 + index * step, d0 + (index + 1) * step];
  };

  scale.copy = (): QuantizeScale<Range> =>
    scaleQuantize<Range>({ domain: [d0, d1], range: rangeValues });

  return scale;
}

export interface ThresholdScale<Range> {
  (value: number): Range;
  domain(): number[];
  domain(values: Iterable<number>): this;
  range(): Range[];
  range(values: Iterable<Range>): this;
  invertExtent(value: Range): [number, number] | undefined;
  copy(): ThresholdScale<Range>;
}

export function scaleThreshold<Range>(options: {
  domain?: Iterable<number>;
  range?: Iterable<Range>;
}): ThresholdScale<Range> {
  let thresholds: number[] = [...(options.domain ?? [])];
  let rangeValues: Range[] = [...(options.range ?? [])];

  const scale = ((value: number): Range => {
    if (rangeValues.length === 0) return undefined as Range;
    if (Number.isNaN(value)) return rangeValues[0] as Range;
    const index = Math.min(bisectRight(thresholds, value), rangeValues.length - 1);
    return rangeValues[index] as Range;
  }) as ThresholdScale<Range>;

  scale.domain = ((values?: Iterable<number>) => {
    if (values === undefined) return [...thresholds];
    thresholds = [...values];
    return scale;
  }) as ThresholdScale<Range>['domain'];

  scale.range = ((values?: Iterable<Range>) => {
    if (values === undefined) return [...rangeValues];
    rangeValues = [...values];
    return scale;
  }) as ThresholdScale<Range>['range'];

  scale.invertExtent = (value: Range): [number, number] | undefined => {
    const index = rangeValues.indexOf(value);
    if (index < 0) return undefined;
    return [
      thresholds[index - 1] ?? Number.NEGATIVE_INFINITY,
      thresholds[index] ?? Number.POSITIVE_INFINITY,
    ];
  };

  scale.copy = (): ThresholdScale<Range> =>
    scaleThreshold<Range>({ domain: thresholds, range: rangeValues });

  return scale;
}
