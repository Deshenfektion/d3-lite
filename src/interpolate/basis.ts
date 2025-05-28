export type Interpolator<T> = (t: number) => T;

export type InterpolatorFactory<T> = (a: T, b: T) => Interpolator<T>;

export function interpolateNumber(a: number, b: number): Interpolator<number> {
  const delta = b - a;
  return (t) => a + delta * t;
}

export function interpolateRound(a: number, b: number): Interpolator<number> {
  const delta = b - a;
  return (t) => Math.round(a + delta * t);
}

export function interpolateArray(
  a: readonly number[],
  b: readonly number[]
): Interpolator<number[]> {
  const n = Math.min(a.length, b.length);
  const parts: Interpolator<number>[] = [];
  for (let i = 0; i < n; i++) parts.push(interpolateNumber(a[i] as number, b[i] as number));
  return (t) => parts.map((part) => part(t));
}

export function interpolateObject<T extends Record<string, number>>(
  a: T,
  b: T
): Interpolator<T> {
  const keys = Object.keys(a).filter((key) => key in b);
  const parts = keys.map(
    (key) => [key, interpolateNumber(a[key] as number, b[key] as number)] as const
  );
  return (t) => {
    const out: Record<string, number> = {};
    for (const [key, part] of parts) out[key] = part(t);
    return out as T;
  };
}

export function piecewiseInterpolator<T>(
  values: readonly T[],
  factory: InterpolatorFactory<T>
): Interpolator<T> {
  const n = values.length - 1;
  if (n < 1) return () => values[0] as T;
  const segments: Interpolator<T>[] = [];
  for (let i = 0; i < n; i++) {
    segments.push(factory(values[i] as T, values[i + 1] as T));
  }
  return (t) => {
    const scaled = Math.max(0, Math.min(1, t)) * n;
    const index = Math.min(Math.floor(scaled), n - 1);
    return (segments[index] as Interpolator<T>)(scaled - index);
  };
}
