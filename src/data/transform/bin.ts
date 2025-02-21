import type { Row } from '../../types/data.ts';
import { extent } from '../../utils/array.ts';
import { toNumber } from '../../utils/guards.ts';
import { niceDomain, tickStep } from '../../utils/math.ts';
import { createDataset } from '../dataset.ts';
import type { Transform } from './types.ts';

export interface BinOptions {
  readonly field: string;
  readonly count?: number;
  readonly domain?: readonly [number, number];
  readonly nice?: boolean;
  readonly as?: { start?: string; end?: string; count?: string };
}

export interface Bin {
  readonly start: number;
  readonly end: number;
  readonly count: number;
  readonly rows: readonly Row[];
}

export function computeBins(values: readonly number[], options: BinOptions): Bin[] {
  const clean = values.filter((value) => !Number.isNaN(value));
  if (clean.length === 0) return [];

  const targetCount = options.count ?? Math.ceil(Math.sqrt(clean.length));
  const rawDomain = options.domain ?? extent(clean, (v) => v) ?? [0, 1];
  const [lo, hi] =
    options.nice === false ? rawDomain : niceDomain(rawDomain[0], rawDomain[1], targetCount);

  if (lo === hi) {
    return [{ start: lo, end: hi, count: clean.length, rows: [] }];
  }

  const step = tickStep(lo, hi, targetCount);
  const binCount = Math.max(1, Math.round((hi - lo) / step));
  const counts = new Array<number>(binCount).fill(0);

  for (const value of clean) {
    if (value < lo || value > hi) continue;
    const index = value === hi ? binCount - 1 : Math.floor((value - lo) / step);
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((count, index) => ({
    start: lo + index * step,
    end: lo + (index + 1) * step,
    count,
    rows: [],
  }));
}

export function bin(options: BinOptions): Transform {
  const startKey = options.as?.start ?? 'bin_start';
  const endKey = options.as?.end ?? 'bin_end';
  const countKey = options.as?.count ?? 'count';

  return (dataset) => {
    const values: number[] = [];
    for (const row of dataset.rows) {
      const value = toNumber(row[options.field] ?? null);
      if (!Number.isNaN(value)) values.push(value);
    }

    const bins = computeBins(values, options);
    const rows: Row[] = bins.map((entry) => ({
      [startKey]: entry.start,
      [endKey]: entry.end,
      [countKey]: entry.count,
    }));

    return createDataset(rows, { fieldOrder: [startKey, endKey, countKey] });
  };
}
