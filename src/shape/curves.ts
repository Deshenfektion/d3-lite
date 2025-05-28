import type { PathSink } from './path.ts';
import type { Point } from '../types/geometry.ts';

export type CurveRenderer = (sink: PathSink, points: readonly Point[]) => void;

export type CurveKind = 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'basis';

export const curveLinear: CurveRenderer = (sink, points) => {
  points.forEach((point, index) => {
    if (index === 0) sink.moveTo(point.x, point.y);
    else sink.lineTo(point.x, point.y);
  });
};

function stepWith(position: number): CurveRenderer {
  return (sink, points) => {
    points.forEach((point, index) => {
      if (index === 0) {
        sink.moveTo(point.x, point.y);
        return;
      }
      const previous = points[index - 1] as Point;
      const midX = previous.x + (point.x - previous.x) * position;
      sink.lineTo(midX, previous.y);
      sink.lineTo(midX, point.y);
      sink.lineTo(point.x, point.y);
    });
  };
}

export const curveStep: CurveRenderer = stepWith(0.5);
export const curveStepBefore: CurveRenderer = stepWith(0);
export const curveStepAfter: CurveRenderer = stepWith(1);

function slope(a: Point, b: Point): number {
  const dx = b.x - a.x;
  return dx === 0 ? 0 : (b.y - a.y) / dx;
}

export const curveMonotoneX: CurveRenderer = (sink, points) => {
  const n = points.length;
  if (n === 0) return;
  if (n < 3) {
    curveLinear(sink, points);
    return;
  }

  const secants = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    secants[i] = slope(points[i] as Point, points[i + 1] as Point);
  }

  const tangents = new Array<number>(n);
  tangents[0] = secants[0] as number;
  tangents[n - 1] = secants[n - 2] as number;
  for (let i = 1; i < n - 1; i++) {
    const previous = secants[i - 1] as number;
    const next = secants[i] as number;
    tangents[i] = previous * next <= 0 ? 0 : (previous + next) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const secant = secants[i] as number;
    let ta = tangents[i] as number;
    let tb = tangents[i + 1] as number;

    if (secant === 0) {
      ta = 0;
      tb = 0;
    } else {
      const alpha = ta / secant;
      const beta = tb / secant;
      const magnitude = alpha * alpha + beta * beta;
      if (magnitude > 9) {
        const scale = (3 / Math.sqrt(magnitude)) * secant;
        ta = alpha * scale;
        tb = beta * scale;
      }
    }

    const dx = (b.x - a.x) / 3;
    if (i === 0) sink.moveTo(a.x, a.y);
    sink.bezierCurveTo(a.x + dx, a.y + dx * ta, b.x - dx, b.y - dx * tb, b.x, b.y);
  }
};

export const curveBasis: CurveRenderer = (sink, points) => {
  const n = points.length;
  if (n === 0) return;
  if (n < 3) {
    curveLinear(sink, points);
    return;
  }

  const at = (index: number): Point => points[Math.max(0, Math.min(n - 1, index))] as Point;

  sink.moveTo(at(0).x, at(0).y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    sink.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y
    );
  }
};

const registry: Record<CurveKind, CurveRenderer> = {
  linear: curveLinear,
  step: curveStep,
  stepBefore: curveStepBefore,
  stepAfter: curveStepAfter,
  monotoneX: curveMonotoneX,
  basis: curveBasis,
};

export function curveFor(kind: CurveKind): CurveRenderer {
  return registry[kind];
}
