export function range(start: number, stop?: number, step = 1): number[] {
  const from = stop === undefined ? 0 : start;
  const to = stop === undefined ? start : stop;
  if (step === 0 || !Number.isFinite(step)) return [];
  const n = Math.max(0, Math.ceil((to - from) / step));
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = from + i * step;
  return out;
}

export function ascending(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function descending(a: number, b: number): number {
  return b < a ? -1 : b > a ? 1 : 0;
}

export function min<T>(values: Iterable<T>, accessor: (value: T) => number): number | undefined {
  let result: number | undefined;
  for (const value of values) {
    const v = accessor(value);
    if (v != null && !Number.isNaN(v) && (result === undefined || v < result)) result = v;
  }
  return result;
}

export function max<T>(values: Iterable<T>, accessor: (value: T) => number): number | undefined {
  let result: number | undefined;
  for (const value of values) {
    const v = accessor(value);
    if (v != null && !Number.isNaN(v) && (result === undefined || v > result)) result = v;
  }
  return result;
}

export function extent<T>(
  values: Iterable<T>,
  accessor: (value: T) => number
): [number, number] | undefined {
  let lo: number | undefined;
  let hi: number | undefined;
  for (const value of values) {
    const v = accessor(value);
    if (v == null || Number.isNaN(v)) continue;
    if (lo === undefined || v < lo) lo = v;
    if (hi === undefined || v > hi) hi = v;
  }
  return lo === undefined || hi === undefined ? undefined : [lo, hi];
}

export function sum<T>(values: Iterable<T>, accessor: (value: T) => number): number {
  let total = 0;
  for (const value of values) {
    const v = accessor(value);
    if (v != null && !Number.isNaN(v)) total += v;
  }
  return total;
}

export function mean<T>(values: Iterable<T>, accessor: (value: T) => number): number | undefined {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const v = accessor(value);
    if (v != null && !Number.isNaN(v)) {
      total += v;
      count++;
    }
  }
  return count === 0 ? undefined : total / count;
}

export function quantileSorted(sorted: readonly number[], p: number): number | undefined {
  const n = sorted.length;
  if (n === 0) return undefined;
  if (n === 1) return sorted[0];
  const h = (n - 1) * Math.max(0, Math.min(1, p));
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (h - lo);
}

export function quantile<T>(
  values: Iterable<T>,
  p: number,
  accessor: (value: T) => number
): number | undefined {
  const numbers: number[] = [];
  for (const value of values) {
    const v = accessor(value);
    if (v != null && !Number.isNaN(v)) numbers.push(v);
  }
  numbers.sort(ascending);
  return quantileSorted(numbers, p);
}

export function median<T>(
  values: Iterable<T>,
  accessor: (value: T) => number
): number | undefined {
  return quantile(values, 0.5, accessor);
}

export function variance<T>(
  values: Iterable<T>,
  accessor: (value: T) => number
): number | undefined {
  let count = 0;
  let delta = 0;
  let runningMean = 0;
  let sumOfSquares = 0;
  for (const value of values) {
    const v = accessor(value);
    if (v == null || Number.isNaN(v)) continue;
    count++;
    delta = v - runningMean;
    runningMean += delta / count;
    sumOfSquares += delta * (v - runningMean);
  }
  return count > 1 ? sumOfSquares / (count - 1) : undefined;
}

export function deviation<T>(
  values: Iterable<T>,
  accessor: (value: T) => number
): number | undefined {
  const v = variance(values, accessor);
  return v === undefined ? undefined : Math.sqrt(v);
}

export function bisectLeft(array: readonly number[], value: number): number {
  let lo = 0;
  let hi = array.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((array[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function bisectRight(array: readonly number[], value: number): number {
  let lo = 0;
  let hi = array.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((array[mid] as number) > value) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function group<T, K>(values: Iterable<T>, key: (value: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const value of values) {
    const k = key(value);
    const bucket = map.get(k);
    if (bucket) bucket.push(value);
    else map.set(k, [value]);
  }
  return map;
}

export function rollup<T, K, R>(
  values: Iterable<T>,
  key: (value: T) => K,
  reduce: (bucket: T[]) => R
): Map<K, R> {
  const grouped = group(values, key);
  const out = new Map<K, R>();
  for (const [k, bucket] of grouped) out.set(k, reduce(bucket));
  return out;
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

export function zip<A, B>(a: readonly A[], b: readonly B[]): [A, B][] {
  const n = Math.min(a.length, b.length);
  const out = new Array<[A, B]>(n);
  for (let i = 0; i < n; i++) out[i] = [a[i] as A, b[i] as B];
  return out;
}

export function pairs<T>(values: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 1; i < values.length; i++) out.push([values[i - 1] as T, values[i] as T]);
  return out;
}

export function last<T>(values: readonly T[]): T | undefined {
  return values.length === 0 ? undefined : values[values.length - 1];
}
