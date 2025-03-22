import type { Row } from '../types/data.ts';
import { toNumber } from '../utils/guards.ts';

export interface StackPoint {
  readonly key: string;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly value: number;
  readonly row: Row;
}

export type StackSeries = readonly StackPoint[];

export type StackOffset = 'none' | 'expand' | 'diverging';

export type StackOrder = 'none' | 'ascending' | 'descending' | 'reverse';

export interface StackOptions {
  readonly keys: readonly string[];
  readonly offset?: StackOffset;
  readonly order?: StackOrder;
}

function orderKeys(rows: readonly Row[], keys: readonly string[], order: StackOrder): string[] {
  if (order === 'none') return [...keys];
  if (order === 'reverse') return [...keys].reverse();

  const totals = keys.map((key) => {
    let total = 0;
    for (const row of rows) {
      const value = toNumber(row[key] ?? null);
      if (!Number.isNaN(value)) total += value;
    }
    return { key, total };
  });

  totals.sort((a, b) => (order === 'ascending' ? a.total - b.total : b.total - a.total));
  return totals.map((entry) => entry.key);
}

export function stack(rows: readonly Row[], options: StackOptions): StackSeries[] {
  const offset = options.offset ?? 'none';
  const keys = orderKeys(rows, options.keys, options.order ?? 'none');
  const series: StackPoint[][] = keys.map(() => []);

  rows.forEach((row, index) => {
    if (offset === 'diverging') {
      let positive = 0;
      let negative = 0;
      keys.forEach((key, keyIndex) => {
        const value = toNumber(row[key] ?? null);
        const safe = Number.isNaN(value) ? 0 : value;
        const start = safe >= 0 ? positive : negative;
        const end = start + safe;
        if (safe >= 0) positive = end;
        else negative = end;
        (series[keyIndex] as StackPoint[]).push({ key, index, start, end, value: safe, row });
      });
      return;
    }

    let total = 0;
    if (offset === 'expand') {
      for (const key of keys) {
        const value = toNumber(row[key] ?? null);
        if (!Number.isNaN(value)) total += value;
      }
      if (total === 0) total = 1;
    }

    let cursor = 0;
    keys.forEach((key, keyIndex) => {
      const raw = toNumber(row[key] ?? null);
      const safe = Number.isNaN(raw) ? 0 : raw;
      const value = offset === 'expand' ? safe / total : safe;
      const start = cursor;
      const end = cursor + value;
      cursor = end;
      (series[keyIndex] as StackPoint[]).push({ key, index, start, end, value, row });
    });
  });

  return series;
}

export function stackExtent(series: readonly StackSeries[]): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const points of series) {
    for (const point of points) {
      if (point.start < lo) lo = point.start;
      if (point.end < lo) lo = point.end;
      if (point.start > hi) hi = point.start;
      if (point.end > hi) hi = point.end;
    }
  }
  return [lo, hi];
}
