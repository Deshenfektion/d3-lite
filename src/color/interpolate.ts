import type { Interpolator } from '../interpolate/basis.ts';
import { piecewiseInterpolator } from '../interpolate/basis.ts';
import { hclToRgb, labToRgb, rgbToHcl, rgbToLab } from './lab.ts';
import { formatRgb, parseColor, rgb, type RGB } from './rgb.ts';

const FALLBACK: RGB = rgb(0, 0, 0, 1);

function toRgb(input: string | RGB): RGB {
  return typeof input === 'string' ? (parseColor(input) ?? FALLBACK) : input;
}

export function interpolateRgb(a: string | RGB, b: string | RGB): Interpolator<string> {
  const from = toRgb(a);
  const to = toRgb(b);
  return (t) =>
    formatRgb({
      r: from.r + (to.r - from.r) * t,
      g: from.g + (to.g - from.g) * t,
      b: from.b + (to.b - from.b) * t,
      a: from.a + (to.a - from.a) * t,
    });
}

export function interpolateLab(a: string | RGB, b: string | RGB): Interpolator<string> {
  const from = rgbToLab(toRgb(a));
  const to = rgbToLab(toRgb(b));
  return (t) =>
    formatRgb(
      labToRgb({
        l: from.l + (to.l - from.l) * t,
        a: from.a + (to.a - from.a) * t,
        b: from.b + (to.b - from.b) * t,
        alpha: from.alpha + (to.alpha - from.alpha) * t,
      })
    );
}

export function interpolateHcl(a: string | RGB, b: string | RGB): Interpolator<string> {
  const from = rgbToHcl(toRgb(a));
  const to = rgbToHcl(toRgb(b));

  let delta = to.h - from.h;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;

  return (t) =>
    formatRgb(
      hclToRgb({
        h: from.h + delta * t,
        c: from.c + (to.c - from.c) * t,
        l: from.l + (to.l - from.l) * t,
        alpha: from.alpha + (to.alpha - from.alpha) * t,
      })
    );
}

export type ColorSpace = 'rgb' | 'lab' | 'hcl';

export function colorInterpolatorFor(
  space: ColorSpace
): (a: string, b: string) => Interpolator<string> {
  switch (space) {
    case 'lab':
      return interpolateLab;
    case 'hcl':
      return interpolateHcl;
    case 'rgb':
      return interpolateRgb;
  }
}

export function rampInterpolator(
  colors: readonly string[],
  space: ColorSpace = 'lab'
): Interpolator<string> {
  return piecewiseInterpolator(colors, colorInterpolatorFor(space));
}
