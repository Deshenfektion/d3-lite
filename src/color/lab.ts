import { clamp } from '../utils/math.ts';
import { rgb, type RGB } from './rgb.ts';

export interface LAB {
  l: number;
  a: number;
  b: number;
  alpha: number;
}

export interface HCL {
  h: number;
  c: number;
  l: number;
  alpha: number;
}

const Xn = 0.95047;
const Yn = 1;
const Zn = 1.08883;
const DELTA = 6 / 29;
const DELTA_CUBED = DELTA ** 3;
const DELTA_SQUARED_TIMES_3 = 3 * DELTA ** 2;

function srgbToLinear(channel: number): number {
  const value = clamp(channel, 0, 255) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const corrected = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return clamp(corrected * 255, 0, 255);
}

function forward(t: number): number {
  return t > DELTA_CUBED ? Math.cbrt(t) : t / DELTA_SQUARED_TIMES_3 + 4 / 29;
}

function inverse(t: number): number {
  return t > DELTA ? t ** 3 : DELTA_SQUARED_TIMES_3 * (t - 4 / 29);
}

export function rgbToLab(color: RGB): LAB {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);

  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / Xn;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / Yn;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / Zn;

  const fx = forward(x);
  const fy = forward(y);
  const fz = forward(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
    alpha: color.a,
  };
}

export function labToRgb(color: LAB): RGB {
  const fy = (color.l + 16) / 116;
  const fx = fy + color.a / 500;
  const fz = fy - color.b / 200;

  const x = Xn * inverse(fx);
  const y = Yn * inverse(fy);
  const z = Zn * inverse(fz);

  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return rgb(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b), color.alpha);
}

export function labToHcl(color: LAB): HCL {
  const c = Math.hypot(color.a, color.b);
  let h = (Math.atan2(color.b, color.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { h, c, l: color.l, alpha: color.alpha };
}

export function hclToLab(color: HCL): LAB {
  const radians = (color.h * Math.PI) / 180;
  return {
    l: color.l,
    a: Math.cos(radians) * color.c,
    b: Math.sin(radians) * color.c,
    alpha: color.alpha,
  };
}

export function hclToRgb(color: HCL): RGB {
  return labToRgb(hclToLab(color));
}

export function rgbToHcl(color: RGB): HCL {
  return labToHcl(rgbToLab(color));
}
