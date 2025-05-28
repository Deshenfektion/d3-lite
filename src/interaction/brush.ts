import type { Point, Rect } from '../types/geometry.ts';
import type { ContinuousScale } from '../scales/types.ts';
import { clamp } from '../utils/math.ts';
import { createDispatcher, type Dispatcher } from './dispatcher.ts';

export type BrushAxis = 'x' | 'y' | 'both';

export interface BrushSelection {
  readonly rect: Rect;
  readonly empty: boolean;
}

export interface BrushEvents extends Record<string, unknown> {
  start: BrushSelection;
  brush: BrushSelection;
  end: BrushSelection;
  clear: undefined;
}

export interface BrushOptions {
  readonly extent: Rect;
  readonly axis?: BrushAxis;
  readonly minSize?: number;
}

export interface BrushBehavior extends Dispatcher<BrushEvents> {
  selection(): BrushSelection | undefined;
  clearSelection(): void;
  detach(): void;
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function selectionToDomain(
  rect: Rect,
  scale: ContinuousScale,
  axis: 'x' | 'y'
): [number, number] {
  const lo = axis === 'x' ? rect.x : rect.y;
  const hi = axis === 'x' ? rect.x + rect.width : rect.y + rect.height;
  const a = scale.invert(lo);
  const b = scale.invert(hi);
  return a <= b ? [a, b] : [b, a];
}

export function attachBrush(element: Element, options: BrushOptions): BrushBehavior {
  const dispatcher = createDispatcher<BrushEvents>();
  const axis = options.axis ?? 'x';
  const minSize = options.minSize ?? 4;
  const { extent } = options;

  let dragging = false;
  let origin: Point | undefined;
  let current: BrushSelection | undefined;

  const localOf = (event: { clientX: number; clientY: number }): Point => {
    const bounds = element.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, extent.x, extent.x + extent.width),
      y: clamp(event.clientY - bounds.top, extent.y, extent.y + extent.height),
    };
  };

  const buildSelection = (from: Point, to: Point): BrushSelection => {
    const rect = normalizeRect(from, to);
    const constrained: Rect =
      axis === 'x'
        ? { x: rect.x, y: extent.y, width: rect.width, height: extent.height }
        : axis === 'y'
          ? { x: extent.x, y: rect.y, width: extent.width, height: rect.height }
          : rect;
    const empty = (axis === 'y' ? constrained.height : constrained.width) < minSize;
    return { rect: constrained, empty };
  };

  const onDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    dragging = true;
    origin = localOf(pointer);
    current = buildSelection(origin, origin);
    dispatcher.emit('start', current);
  };

  const onMove = (event: Event): void => {
    if (!dragging || !origin) return;
    current = buildSelection(origin, localOf(event as PointerEvent));
    dispatcher.emit('brush', current);
  };

  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    origin = undefined;
    if (!current) return;
    if (current.empty) {
      current = undefined;
      dispatcher.emit('clear', undefined);
      return;
    }
    dispatcher.emit('end', current);
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointerleave', onUp);

  return {
    ...dispatcher,

    selection(): BrushSelection | undefined {
      return current;
    },

    clearSelection(): void {
      current = undefined;
      dispatcher.emit('clear', undefined);
    },

    detach(): void {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointerleave', onUp);
      dispatcher.clear();
    },
  };
}
