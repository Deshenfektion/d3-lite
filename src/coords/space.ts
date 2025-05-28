import type { Margin, Orientation, Point, Rect, Size } from '../types/geometry.ts';

export const defaultMargin: Margin = { top: 16, right: 16, bottom: 32, left: 48 };

export interface CartesianSpaceOptions {
  readonly width: number;
  readonly height: number;
  readonly margin?: Partial<Margin>;
}

export interface CartesianSpace {
  readonly outer: Size;
  readonly margin: Margin;
  readonly inner: Size;
  readonly plot: Rect;
  toScreen(point: Point): Point;
  toPlot(point: Point): Point;
  containsScreen(point: Point): boolean;
  containsPlot(point: Point): boolean;
  clampToPlot(point: Point): Point;
  axisAnchor(orientation: Orientation): Point;
  resize(size: Partial<Size>): CartesianSpace;
}

export function resolveMargin(margin: Partial<Margin> | undefined): Margin {
  return {
    top: margin?.top ?? defaultMargin.top,
    right: margin?.right ?? defaultMargin.right,
    bottom: margin?.bottom ?? defaultMargin.bottom,
    left: margin?.left ?? defaultMargin.left,
  };
}

export function createCartesianSpace(options: CartesianSpaceOptions): CartesianSpace {
  const margin = resolveMargin(options.margin);
  const outer: Size = { width: options.width, height: options.height };
  const inner: Size = {
    width: Math.max(0, outer.width - margin.left - margin.right),
    height: Math.max(0, outer.height - margin.top - margin.bottom),
  };
  const plot: Rect = {
    x: margin.left,
    y: margin.top,
    width: inner.width,
    height: inner.height,
  };

  const space: CartesianSpace = {
    outer,
    margin,
    inner,
    plot,

    toScreen(point) {
      return { x: point.x + margin.left, y: point.y + margin.top };
    },

    toPlot(point) {
      return { x: point.x - margin.left, y: point.y - margin.top };
    },

    containsScreen(point) {
      return (
        point.x >= plot.x &&
        point.x <= plot.x + plot.width &&
        point.y >= plot.y &&
        point.y <= plot.y + plot.height
      );
    },

    containsPlot(point) {
      return point.x >= 0 && point.x <= inner.width && point.y >= 0 && point.y <= inner.height;
    },

    clampToPlot(point) {
      return {
        x: Math.min(Math.max(point.x, 0), inner.width),
        y: Math.min(Math.max(point.y, 0), inner.height),
      };
    },

    axisAnchor(orientation: Orientation) {
      switch (orientation) {
        case 'top':
          return { x: 0, y: 0 };
        case 'right':
          return { x: inner.width, y: 0 };
        case 'bottom':
          return { x: 0, y: inner.height };
        case 'left':
          return { x: 0, y: 0 };
      }
    },

    resize(size) {
      return createCartesianSpace({
        width: size.width ?? outer.width,
        height: size.height ?? outer.height,
        margin,
      });
    },
  };

  return space;
}

export function estimateLeftMargin(labels: readonly string[], charWidth = 7): number {
  let longest = 0;
  for (const label of labels) longest = Math.max(longest, label.length);
  return Math.min(120, Math.max(32, longest * charWidth + 16));
}

export function estimateBottomMargin(rotated: boolean, lineHeight = 14): number {
  return rotated ? lineHeight * 3 : lineHeight * 2;
}
