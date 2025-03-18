import type { Point } from '../types/geometry.ts';
import { clamp } from '../utils/math.ts';
import type { ContinuousScale } from '../scales/types.ts';

export interface ZoomTransform {
  readonly k: number;
  readonly x: number;
  readonly y: number;
}

export const identityZoom: ZoomTransform = { k: 1, x: 0, y: 0 };

export function applyX(transform: ZoomTransform, x: number): number {
  return x * transform.k + transform.x;
}

export function applyY(transform: ZoomTransform, y: number): number {
  return y * transform.k + transform.y;
}

export function applyPoint(transform: ZoomTransform, point: Point): Point {
  return { x: applyX(transform, point.x), y: applyY(transform, point.y) };
}

export function invertX(transform: ZoomTransform, x: number): number {
  return (x - transform.x) / transform.k;
}

export function invertY(transform: ZoomTransform, y: number): number {
  return (y - transform.y) / transform.k;
}

export function invertPoint(transform: ZoomTransform, point: Point): Point {
  return { x: invertX(transform, point.x), y: invertY(transform, point.y) };
}

export function translateBy(transform: ZoomTransform, dx: number, dy: number): ZoomTransform {
  return { k: transform.k, x: transform.x + dx, y: transform.y + dy };
}

export function scaleAbout(
  transform: ZoomTransform,
  factor: number,
  origin: Point,
  extent: readonly [number, number] = [1, 40]
): ZoomTransform {
  const k = clamp(transform.k * factor, extent[0], extent[1]);
  const ratio = k / transform.k;
  return {
    k,
    x: origin.x - (origin.x - transform.x) * ratio,
    y: origin.y - (origin.y - transform.y) * ratio,
  };
}

export function constrain(
  transform: ZoomTransform,
  width: number,
  height: number
): ZoomTransform {
  const minX = width - width * transform.k;
  const minY = height - height * transform.k;
  return {
    k: transform.k,
    x: clamp(transform.x, Math.min(0, minX), Math.max(0, minX)),
    y: clamp(transform.y, Math.min(0, minY), Math.max(0, minY)),
  };
}

export function toMatrixString(transform: ZoomTransform): string {
  return `translate(${transform.x}, ${transform.y}) scale(${transform.k})`;
}

export function rescaleX(scale: ContinuousScale, transform: ZoomTransform): ContinuousScale {
  const next = scale.copy();
  const range = scale.range();
  const lo = range[0] as number;
  const hi = range[range.length - 1] as number;
  return next.domain([scale.invert(invertX(transform, lo)), scale.invert(invertX(transform, hi))]);
}

export function rescaleY(scale: ContinuousScale, transform: ZoomTransform): ContinuousScale {
  const next = scale.copy();
  const range = scale.range();
  const lo = range[0] as number;
  const hi = range[range.length - 1] as number;
  return next.domain([scale.invert(invertY(transform, lo)), scale.invert(invertY(transform, hi))]);
}
