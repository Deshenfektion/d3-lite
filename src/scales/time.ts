import { formatTime, type TimeUnit } from '../utils/format.ts';
import { createContinuousScale, identityTransform } from './continuous.ts';
import type { ContinuousScale } from './types.ts';

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

interface TimeInterval {
  readonly step: number;
  readonly unit: TimeUnit;
  readonly floor: (date: Date) => Date;
  readonly increment: (date: Date, steps: number) => Date;
}

const intervals: TimeInterval[] = [
  {
    step: SECOND,
    unit: 'second',
    floor: (date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      ),
    increment: (date, steps) => new Date(date.getTime() + steps * SECOND),
  },
  {
    step: MINUTE,
    unit: 'minute',
    floor: (date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes()
      ),
    increment: (date, steps) => new Date(date.getTime() + steps * MINUTE),
  },
  {
    step: HOUR,
    unit: 'hour',
    floor: (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()),
    increment: (date, steps) => new Date(date.getTime() + steps * HOUR),
  },
  {
    step: DAY,
    unit: 'day',
    floor: (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    increment: (date, steps) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate() + steps),
  },
  {
    step: MONTH,
    unit: 'month',
    floor: (date) => new Date(date.getFullYear(), date.getMonth(), 1),
    increment: (date, steps) => new Date(date.getFullYear(), date.getMonth() + steps, 1),
  },
  {
    step: YEAR,
    unit: 'year',
    floor: (date) => new Date(date.getFullYear(), 0, 1),
    increment: (date, steps) => new Date(date.getFullYear() + steps, 0, 1),
  },
];

export function pickTimeInterval(span: number, count: number): TimeInterval {
  const target = span / Math.max(1, count);
  let chosen = intervals[0] as TimeInterval;
  for (const interval of intervals) {
    if (interval.step <= target) chosen = interval;
  }
  return chosen;
}

export interface TimeScaleOptions {
  readonly domain?: readonly (Date | number)[];
  readonly range?: readonly number[];
  readonly clamp?: boolean;
}

export interface TimeScale extends ContinuousScale {
  invertTime(value: number): Date;
  timeTicks(count?: number): Date[];
  timeFormat(count?: number): (value: Date | number) => string;
}

function toMillis(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

export function scaleTime(options: TimeScaleOptions = {}): TimeScale {
  const domain = (options.domain ?? [new Date(2025, 0, 1), new Date(2025, 11, 31)]).map(
    toMillis
  );
  const base = createContinuousScale({
    transform: identityTransform,
    domain,
    ...(options.range === undefined ? {} : { range: options.range }),
  });
  if (options.clamp) base.clamp(true);

  const scale = base as TimeScale;

  scale.invertTime = (value: number): Date => new Date(scale.invert(value));

  scale.timeTicks = (count = 10): Date[] => {
    const values = scale.domain();
    const lo = values[0] as number;
    const hi = values[values.length - 1] as number;
    const reverse = hi < lo;
    const [start, stop] = reverse ? [hi, lo] : [lo, hi];
    const interval = pickTimeInterval(stop - start, count);

    const stepCount = Math.max(1, Math.round((stop - start) / interval.step / count));
    const out: Date[] = [];
    let current = interval.floor(new Date(start));
    if (current.getTime() < start) current = interval.increment(current, stepCount);

    let guard = 0;
    while (current.getTime() <= stop && guard < 1000) {
      out.push(new Date(current.getTime()));
      current = interval.increment(current, stepCount);
      guard++;
    }

    return reverse ? out.reverse() : out;
  };

  scale.timeFormat = (count = 10): ((value: Date | number) => string) => {
    const values = scale.domain();
    const lo = values[0] as number;
    const hi = values[values.length - 1] as number;
    const interval = pickTimeInterval(Math.abs(hi - lo), count);
    return formatTime(interval.unit);
  };

  scale.ticks = (count = 10): number[] => scale.timeTicks(count).map((date) => date.getTime());

  return scale;
}
