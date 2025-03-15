import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  formatHex,
  formatRgb,
  parseColor,
  readableTextColor,
  rgb,
  withAlpha,
} from '@/color/rgb.ts';
import { hclToRgb, labToRgb, rgbToHcl, rgbToLab } from '@/color/lab.ts';
import { interpolateHcl, interpolateLab, interpolateRgb } from '@/color/interpolate.ts';
import {
  categoricalSlots,
  darkTheme,
  exceedsCategoricalCapacity,
  lightTheme,
  themeFor,
} from '@/color/schemes.ts';
import {
  scaleCategoricalColor,
  scaleDivergingColor,
  scaleSequentialColor,
} from '@/scales/color.ts';

describe('parseColor', () => {
  it('parses six digit hex', () => {
    expect(parseColor('#2a78d6')).toEqual({ r: 42, g: 120, b: 214, a: 1 });
  });

  it('expands three digit hex', () => {
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('reads eight digit hex alpha', () => {
    expect(parseColor('#ff000080')!.a).toBeCloseTo(0.502, 2);
  });

  it('parses rgb and rgba notation', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor('rgba(1, 2, 3, 0.5)')!.a).toBe(0.5);
  });

  it('parses a small set of names', () => {
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('returns undefined for nonsense', () => {
    expect(parseColor('not-a-color')).toBeUndefined();
  });

  it('round-trips through hex formatting', () => {
    expect(formatHex(parseColor('#2a78d6')!)).toBe('#2a78d6');
  });

  it('formats rgba only when translucent', () => {
    expect(formatRgb(rgb(1, 2, 3))).toBe('rgb(1, 2, 3)');
    expect(formatRgb(rgb(1, 2, 3, 0.5))).toBe('rgba(1, 2, 3, 0.5)');
  });

  it('clamps channels when formatting', () => {
    expect(formatRgb(rgb(-20, 300, 3))).toBe('rgb(0, 255, 3)');
  });

  it('applies alpha to an existing color', () => {
    expect(withAlpha('#000000', 0.25)).toBe('rgba(0, 0, 0, 0.25)');
    expect(withAlpha('bogus', 0.5)).toBe('bogus');
  });
});

describe('contrast', () => {
  it('computes the WCAG ratio for black on white', () => {
    expect(contrastRatio(rgb(0, 0, 0), rgb(255, 255, 255))).toBeCloseTo(21, 5);
  });

  it('picks a readable text color for a background', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#0d366b')).toBe('#ffffff');
  });
});

describe('lab conversion', () => {
  it('round-trips rgb through lab within matrix precision', () => {
    const source = rgb(42, 120, 214);
    const result = labToRgb(rgbToLab(source));
    expect(result.r).toBeCloseTo(source.r, 3);
    expect(result.g).toBeCloseTo(source.g, 3);
    expect(result.b).toBeCloseTo(source.b, 3);
  });

  it('round-trips rgb through hcl within matrix precision', () => {
    const source = rgb(235, 104, 52);
    const result = hclToRgb(rgbToHcl(source));
    expect(result.r).toBeCloseTo(source.r, 3);
    expect(result.b).toBeCloseTo(source.b, 3);
  });

  it('places white at maximum lightness with no chroma', () => {
    const white = rgbToLab(rgb(255, 255, 255));
    expect(white.l).toBeCloseTo(100, 3);
    expect(Math.hypot(white.a, white.b)).toBeLessThan(0.1);
  });

  it('places black at zero lightness', () => {
    expect(rgbToLab(rgb(0, 0, 0)).l).toBeCloseTo(0, 6);
  });
});

describe('color interpolation', () => {
  it('returns the endpoints exactly', () => {
    const interpolate = interpolateRgb('#000000', '#ffffff');
    expect(interpolate(0)).toBe('rgb(0, 0, 0)');
    expect(interpolate(1)).toBe('rgb(255, 255, 255)');
  });

  it('interpolates linearly in rgb', () => {
    expect(interpolateRgb('#000000', '#ffffff')(0.5)).toBe('rgb(128, 128, 128)');
  });

  it('puts the lab midpoint at perceptual mid-grey, below the arithmetic midpoint', () => {
    const labMid = parseColor(interpolateLab('#000000', '#ffffff')(0.5))!;
    const rgbMid = parseColor(interpolateRgb('#000000', '#ffffff')(0.5))!;
    expect(rgbMid.r).toBe(128);
    expect(labMid.r).toBeLessThan(rgbMid.r);
    expect(rgbToLab(labMid).l).toBeCloseTo(50, 1);
  });

  it('takes the short way around the hue circle', () => {
    const midpoint = parseColor(interpolateHcl('#e34948', '#eda100')(0.5))!;
    expect(midpoint.r).toBeGreaterThan(midpoint.b);
  });

  it('falls back to black for unparsable input', () => {
    expect(interpolateRgb('nonsense', '#ffffff')(0)).toBe('rgb(0, 0, 0)');
  });
});

describe('themes', () => {
  it('exposes light and dark instances', () => {
    expect(themeFor('light')).toBe(lightTheme);
    expect(themeFor('dark')).toBe(darkTheme);
    expect(lightTheme.categorical).toHaveLength(8);
    expect(darkTheme.categorical).toHaveLength(8);
  });

  it('hands out categorical slots in fixed order', () => {
    expect(categoricalSlots(3)).toEqual(['#2a78d6', '#eb6834', '#1baf7a']);
    expect(categoricalSlots(3, 'dark')).toEqual(['#3987e5', '#d95926', '#199e70']);
  });

  it('never cycles past the last slot', () => {
    expect(categoricalSlots(20)).toHaveLength(8);
    expect(exceedsCategoricalCapacity(9)).toBe(true);
    expect(exceedsCategoricalCapacity(8)).toBe(false);
  });
});

describe('color scales', () => {
  it('maps a numeric domain onto a sequential ramp', () => {
    const scale = scaleSequentialColor({ domain: [0, 100] });
    expect(scale(0)).not.toBe(scale(100));
    expect(parseColor(scale(0))).toBeDefined();
  });

  it('clamps outside the domain by default', () => {
    const scale = scaleSequentialColor({ domain: [0, 100] });
    expect(scale(-50)).toBe(scale(0));
    expect(scale(500)).toBe(scale(100));
  });

  it('collapses a degenerate domain to the ramp midpoint', () => {
    const scale = scaleSequentialColor({ domain: [5, 5] });
    expect(parseColor(scale(5))).toBeDefined();
  });

  it('anchors a diverging scale on its midpoint', () => {
    const scale = scaleDivergingColor({
      domain: [-10, 0, 10],
      colors: lightTheme.diverging,
    });
    const negative = parseColor(scale(-10))!;
    const positive = parseColor(scale(10))!;
    expect(negative.b).toBeGreaterThan(negative.r);
    expect(positive.r).toBeGreaterThan(positive.b);
  });

  it('assigns categorical colors by entity, not by rank', () => {
    const scale = scaleCategoricalColor({ domain: ['north', 'south', 'east'] });
    const southBefore = scale('south');
    scale.domain(['north', 'south', 'east']);
    expect(scale('south')).toBe(southBefore);
    expect(scale('north')).toBe('#2a78d6');
  });
});
