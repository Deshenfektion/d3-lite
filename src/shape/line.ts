import type { Point } from '../types/geometry.ts';
import { curveFor, type CurveKind, type CurveRenderer } from './curves.ts';
import { PathBuilder, type PathSink } from './path.ts';

export interface IndexedPoint extends Point {
  readonly index: number;
}

export interface LineOptions {
  readonly curve?: CurveKind | CurveRenderer;
  readonly precision?: number;
  readonly defined?: (point: Point, index: number) => boolean;
}

function resolveCurve(curve: LineOptions['curve']): CurveRenderer {
  if (curve === undefined) return curveFor('linear');
  return typeof curve === 'string' ? curveFor(curve) : curve;
}

function defaultDefined(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function segmentsOf(
  points: readonly Point[],
  defined?: (point: Point, index: number) => boolean
): IndexedPoint[][] {
  const isDefined = defined ?? defaultDefined;
  const segments: IndexedPoint[][] = [];
  let current: IndexedPoint[] = [];

  points.forEach((point, index) => {
    if (isDefined(point, index)) {
      current.push({ x: point.x, y: point.y, index });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  });

  if (current.length > 0) segments.push(current);
  return segments;
}

function drawSegment(sink: PathSink, render: CurveRenderer, segment: readonly Point[]): void {
  if (segment.length === 1) {
    const only = segment[0] as Point;
    sink.moveTo(only.x, only.y);
    sink.lineTo(only.x, only.y);
    return;
  }
  render(sink, segment);
}

class ContinuingSink implements PathSink {
  private started = false;

  constructor(private readonly target: PathSink) {}

  moveTo(x: number, y: number): void {
    if (this.started) this.target.lineTo(x, y);
    else {
      this.target.lineTo(x, y);
      this.started = true;
    }
  }

  lineTo(x: number, y: number): void {
    this.target.lineTo(x, y);
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.target.bezierCurveTo(x1, y1, x2, y2, x, y);
  }

  closePath(): void {
    this.target.closePath();
  }
}

export function linePath(points: readonly Point[], options: LineOptions = {}): string {
  const render = resolveCurve(options.curve);
  const builder = new PathBuilder(options.precision ?? 2);
  for (const segment of segmentsOf(points, options.defined)) {
    drawSegment(builder, render, segment);
  }
  return builder.toString();
}

export function areaPath(
  upper: readonly Point[],
  baseline: readonly Point[] | number,
  options: LineOptions = {}
): string {
  const render = resolveCurve(options.curve);
  const builder = new PathBuilder(options.precision ?? 2);

  for (const segment of segmentsOf(upper, options.defined)) {
    if (segment.length === 0) continue;
    drawSegment(builder, render, segment);

    const lower: Point[] = [];
    for (let i = segment.length - 1; i >= 0; i--) {
      const top = segment[i] as IndexedPoint;
      if (typeof baseline === 'number') {
        lower.push({ x: top.x, y: baseline });
      } else {
        const source = baseline[top.index];
        if (source) lower.push(source);
      }
    }

    if (lower.length > 0) drawSegment(new ContinuingSink(builder), render, lower);
    builder.closePath();
  }

  return builder.toString();
}
