import type { Scale } from './types.ts';

export interface OrdinalScale<Range> extends Scale<string, Range> {
  unknown(): Range | undefined;
  unknown(value: Range): this;
  copy(): OrdinalScale<Range>;
}

export interface OrdinalScaleOptions<Range> {
  readonly domain?: Iterable<string>;
  readonly range?: Iterable<Range>;
  readonly unknown?: Range;
}

export function scaleOrdinal<Range>(
  options: OrdinalScaleOptions<Range> = {}
): OrdinalScale<Range> {
  let domainValues: string[] = [...(options.domain ?? [])];
  let rangeValues: Range[] = [...(options.range ?? [])];
  let unknownValue: Range | undefined = options.unknown;
  let index = new Map<string, number>();

  const reindex = (): void => {
    index = new Map();
    domainValues.forEach((key, position) => {
      if (!index.has(key)) index.set(key, position);
    });
  };
  reindex();

  const scale = ((value: string): Range => {
    let position = index.get(value);
    if (position === undefined) {
      if (unknownValue !== undefined) return unknownValue;
      position = domainValues.length;
      domainValues.push(value);
      index.set(value, position);
    }
    if (rangeValues.length === 0) return unknownValue as Range;
    return rangeValues[position % rangeValues.length] as Range;
  }) as OrdinalScale<Range>;

  scale.domain = ((values?: Iterable<string>) => {
    if (values === undefined) return [...domainValues];
    domainValues = [];
    index = new Map();
    for (const value of values) {
      if (index.has(value)) continue;
      index.set(value, domainValues.length);
      domainValues.push(value);
    }
    return scale;
  }) as OrdinalScale<Range>['domain'];

  scale.range = ((values?: Iterable<Range>) => {
    if (values === undefined) return [...rangeValues];
    rangeValues = [...values];
    return scale;
  }) as OrdinalScale<Range>['range'];

  scale.unknown = ((value?: Range) => {
    if (value === undefined) return unknownValue;
    unknownValue = value;
    return scale;
  }) as OrdinalScale<Range>['unknown'];

  scale.copy = (): OrdinalScale<Range> =>
    scaleOrdinal<Range>({
      domain: domainValues,
      range: rangeValues,
      ...(unknownValue === undefined ? {} : { unknown: unknownValue }),
    });

  return scale;
}
