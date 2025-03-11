import { clamp } from '../utils/math.ts';

export interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  teal: '#008080',
  transparent: '#00000000',
};

const HEX_PATTERN = /^#?([0-9a-f]{3,8})$/i;
const RGB_PATTERN =
  /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i;

function expandShortHex(hex: string): string {
  let out = '';
  for (const char of hex) out += char + char;
  return out;
}

export function parseColor(input: string): RGB | undefined {
  const text = input.trim().toLowerCase();
  const named = NAMED[text];
  const candidate = named ?? text;

  const hexMatch = HEX_PATTERN.exec(candidate);
  if (hexMatch) {
    let hex = hexMatch[1] as string;
    if (hex.length === 3 || hex.length === 4) hex = expandShortHex(hex);
    if (hex.length !== 6 && hex.length !== 8) return undefined;
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgbMatch = RGB_PATTERN.exec(candidate);
  if (rgbMatch) {
    const alphaRaw = rgbMatch[4];
    const alpha = alphaRaw
      ? alphaRaw.endsWith('%')
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw)
      : 1;
    return {
      r: Number.parseFloat(rgbMatch[1] as string),
      g: Number.parseFloat(rgbMatch[2] as string),
      b: Number.parseFloat(rgbMatch[3] as string),
      a: clamp(alpha, 0, 1),
    };
  }

  return undefined;
}

export function rgb(r: number, g: number, b: number, a = 1): RGB {
  return { r, g, b, a };
}

function channelToHex(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, '0');
}

export function formatHex(color: RGB): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

export function formatRgb(color: RGB): string {
  const r = Math.round(clamp(color.r, 0, 255));
  const g = Math.round(clamp(color.g, 0, 255));
  const b = Math.round(clamp(color.b, 0, 255));
  return color.a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${round3(color.a)})`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function withAlpha(input: string, alpha: number): string {
  const color = parseColor(input);
  if (!color) return input;
  return formatRgb({ ...color, a: clamp(alpha, 0, 1) });
}

export function relativeLuminance(color: RGB): number {
  const channel = (value: number): number => {
    const normalized = clamp(value, 0, 255) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(background: string): string {
  const color = parseColor(background);
  if (!color) return '#000000';
  return contrastRatio(color, rgb(0, 0, 0)) >= contrastRatio(color, rgb(255, 255, 255))
    ? '#000000'
    : '#ffffff';
}
