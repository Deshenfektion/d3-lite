import { describe, expect, it } from 'vitest';
import { createCartesianSpace, estimateLeftMargin, resolveMargin } from '@/coords/space.ts';
import {
  applyPoint,
  constrain,
  identityZoom,
  invertX,
  rescaleX,
  scaleAbout,
  toMatrixString,
  translateBy,
} from '@/coords/transform.ts';
import { scaleLinear } from '@/scales/linear.ts';

describe('resolveMargin', () => {
  it('fills gaps from the default margin', () => {
    expect(resolveMargin({ left: 100 })).toEqual({ top: 16, right: 16, bottom: 32, left: 100 });
    expect(resolveMargin(undefined).left).toBe(48);
  });
});

describe('createCartesianSpace', () => {
  const space = createCartesianSpace({
    width: 400,
    height: 300,
    margin: { top: 10, right: 20, bottom: 30, left: 40 },
  });

  it('subtracts margins to find the plot area', () => {
    expect(space.inner).toEqual({ width: 340, height: 260 });
    expect(space.plot).toEqual({ x: 40, y: 10, width: 340, height: 260 });
  });

  it('never produces a negative plot size', () => {
    const squeezed = createCartesianSpace({
      width: 10,
      height: 10,
      margin: { left: 40, right: 40, top: 40, bottom: 40 },
    });
    expect(squeezed.inner).toEqual({ width: 0, height: 0 });
  });

  it('converts between plot-local and screen coordinates', () => {
    expect(space.toScreen({ x: 0, y: 0 })).toEqual({ x: 40, y: 10 });
    expect(space.toPlot({ x: 40, y: 10 })).toEqual({ x: 0, y: 0 });
  });

  it('round-trips a point through both conversions', () => {
    const point = { x: 123, y: 45 };
    expect(space.toPlot(space.toScreen(point))).toEqual(point);
  });

  it('tests containment in both coordinate systems', () => {
    expect(space.containsScreen({ x: 50, y: 50 })).toBe(true);
    expect(space.containsScreen({ x: 5, y: 5 })).toBe(false);
    expect(space.containsPlot({ x: 0, y: 0 })).toBe(true);
    expect(space.containsPlot({ x: -1, y: 0 })).toBe(false);
  });

  it('clamps a point into the plot area', () => {
    expect(space.clampToPlot({ x: -50, y: 900 })).toEqual({ x: 0, y: 260 });
  });

  it('anchors axes on the correct edge', () => {
    expect(space.axisAnchor('bottom')).toEqual({ x: 0, y: 260 });
    expect(space.axisAnchor('right')).toEqual({ x: 340, y: 0 });
    expect(space.axisAnchor('left')).toEqual({ x: 0, y: 0 });
  });

  it('resizes while keeping margins', () => {
    const resized = space.resize({ width: 800 });
    expect(resized.inner.width).toBe(740);
    expect(resized.inner.height).toBe(260);
  });

  it('estimates a left margin from label widths', () => {
    expect(estimateLeftMargin(['1', '10'])).toBe(32);
    expect(estimateLeftMargin(['a very long tick label'])).toBe(120);
  });
});

describe('zoom transform', () => {
  it('is the identity by default', () => {
    expect(applyPoint(identityZoom, { x: 5, y: 7 })).toEqual({ x: 5, y: 7 });
    expect(toMatrixString(identityZoom)).toBe('translate(0, 0) scale(1)');
  });

  it('applies and inverts consistently', () => {
    const transform = { k: 2, x: 30, y: -10 };
    expect(applyPoint(transform, { x: 10, y: 10 })).toEqual({ x: 50, y: 10 });
    expect(invertX(transform, 50)).toBe(10);
  });

  it('translates without changing scale', () => {
    expect(translateBy({ k: 2, x: 0, y: 0 }, 5, 5)).toEqual({ k: 2, x: 5, y: 5 });
  });

  it('keeps the zoom origin fixed while scaling', () => {
    const origin = { x: 100, y: 50 };
    const zoomed = scaleAbout(identityZoom, 2, origin);
    expect(applyPoint(zoomed, origin)).toEqual(origin);
    expect(zoomed.k).toBe(2);
  });

  it('respects the scale extent', () => {
    expect(scaleAbout(identityZoom, 100, { x: 0, y: 0 }, [1, 8]).k).toBe(8);
    expect(scaleAbout(identityZoom, 0.01, { x: 0, y: 0 }, [1, 8]).k).toBe(1);
  });

  it('constrains panning so the plot stays covered', () => {
    const panned = { k: 2, x: 500, y: 0 };
    expect(constrain(panned, 400, 300).x).toBe(0);
    const far = { k: 2, x: -9999, y: 0 };
    expect(constrain(far, 400, 300).x).toBe(-400);
  });

  it('rescales a continuous scale to the zoomed view', () => {
    const scale = scaleLinear({ domain: [0, 100], range: [0, 400] });
    const zoomed = rescaleX(scale, { k: 2, x: 0, y: 0 });
    expect(zoomed.domain()[0]).toBeCloseTo(0, 6);
    expect(zoomed.domain()[1]).toBeCloseTo(50, 6);
  });
});
