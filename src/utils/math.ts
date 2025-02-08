export const EPSILON = 1e-12;

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

export function normalize(value: number, lo: number, hi: number): number {
  const span = hi - lo;
  return Math.abs(span) < EPSILON ? 0.5 : (value - lo) / span;
}

export function nearlyEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(a), Math.abs(b));
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

export function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  return power >= 0 ? factor * 10 ** power : -(10 ** -power) / factor;
}

export function tickStep(start: number, stop: number, count: number): number {
  const increment = tickIncrement(start, stop, count);
  return increment < 0 ? 1 / -increment : increment;
}

export function ticks(start: number, stop: number, count: number): number[] {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start;
  const [lo, hi] = reverse ? [stop, start] : [start, stop];
  const increment = tickIncrement(lo, hi, count);
  if (!Number.isFinite(increment) || increment === 0) return [];

  let values: number[];
  if (increment > 0) {
    let i0 = Math.round(lo / increment);
    let i1 = Math.round(hi / increment);
    if (i0 * increment < lo) i0++;
    if (i1 * increment > hi) i1--;
    const n = i1 - i0 + 1;
    if (n <= 0) return [];
    values = new Array<number>(n);
    for (let i = 0; i < n; i++) values[i] = (i0 + i) * increment;
  } else {
    const divisor = -increment;
    let i0 = Math.round(lo * divisor);
    let i1 = Math.round(hi * divisor);
    if (i0 / divisor < lo) i0++;
    if (i1 / divisor > hi) i1--;
    const n = i1 - i0 + 1;
    if (n <= 0) return [];
    values = new Array<number>(n);
    for (let i = 0; i < n; i++) values[i] = (i0 + i) / divisor;
  }

  return reverse ? values.reverse() : values;
}

export function niceDomain(start: number, stop: number, count: number): [number, number] {
  if (start === stop) return [start, stop];
  let lo = start;
  let hi = stop;
  const reverse = hi < lo;
  if (reverse) [lo, hi] = [hi, lo];

  for (let guard = 0; guard < 10; guard++) {
    const step = tickIncrement(lo, hi, count);
    if (!Number.isFinite(step)) break;
    if (step > 0) {
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
    } else if (step < 0) {
      lo = Math.ceil(lo * -step) / -step;
      hi = Math.floor(hi * -step) / -step;
    } else {
      break;
    }
    const next = tickIncrement(lo, hi, count);
    if (next === step) break;
  }

  return reverse ? [hi, lo] : [lo, hi];
}

export function sign(value: number): number {
  return value < 0 ? -1 : 1;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function precisionFor(step: number): number {
  if (!Number.isFinite(step) || step === 0) return 0;
  const exponent = Math.floor(Math.log10(Math.abs(step)));
  return exponent >= 0 ? 0 : Math.min(20, -exponent);
}
