import type { Point } from '../types/geometry.ts';
import {
  constrain,
  identityZoom,
  scaleAbout,
  type ZoomTransform,
} from '../coords/transform.ts';
import { createDispatcher, type Dispatcher } from './dispatcher.ts';

export interface ZoomEvents extends Record<string, unknown> {
  zoom: ZoomTransform;
  start: ZoomTransform;
  end: ZoomTransform;
}

export interface ZoomOptions {
  readonly width: number;
  readonly height: number;
  readonly scaleExtent?: readonly [number, number];
  readonly wheelDelta?: number;
  readonly axis?: 'x' | 'y' | 'both';
  readonly constrainToExtent?: boolean;
}

export interface ZoomBehavior extends Dispatcher<ZoomEvents> {
  transform(): ZoomTransform;
  setTransform(next: ZoomTransform): void;
  reset(): void;
  detach(): void;
}

function settle(transform: ZoomTransform, options: ZoomOptions): ZoomTransform {
  return options.constrainToExtent === false
    ? transform
    : constrain(transform, options.width, options.height);
}

export function zoomAtPoint(
  current: ZoomTransform,
  focus: Point,
  factor: number,
  options: ZoomOptions
): ZoomTransform {
  return settle(scaleAbout(current, factor, focus, options.scaleExtent ?? [1, 8]), options);
}

export function attachZoom(element: Element, options: ZoomOptions): ZoomBehavior {
  const dispatcher = createDispatcher<ZoomEvents>();
  const wheelDelta = options.wheelDelta ?? 0.002;
  const axis = options.axis ?? 'both';

  let transform: ZoomTransform = identityZoom;
  let dragging = false;
  let origin: Point | undefined;
  let startTransform: ZoomTransform = identityZoom;

  const localOf = (event: { clientX: number; clientY: number }): Point => {
    const bounds = element.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const commit = (next: ZoomTransform): void => {
    transform = next;
    dispatcher.emit('zoom', transform);
  };

  const onWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    wheel.preventDefault();
    const factor = Math.exp(-wheel.deltaY * wheelDelta);
    commit(zoomAtPoint(transform, localOf(wheel), factor, options));
  };

  const onDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    dragging = true;
    origin = localOf(pointer);
    startTransform = transform;
    dispatcher.emit('start', transform);
  };

  const onMove = (event: Event): void => {
    if (!dragging || !origin) return;
    const pointer = event as PointerEvent;
    const current = localOf(pointer);
    commit(
      settle(
        {
          k: startTransform.k,
          x: axis === 'y' ? startTransform.x : startTransform.x + (current.x - origin.x),
          y: axis === 'x' ? startTransform.y : startTransform.y + (current.y - origin.y),
        },
        options
      )
    );
  };

  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    origin = undefined;
    dispatcher.emit('end', transform);
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointerleave', onUp);

  return {
    ...dispatcher,

    transform(): ZoomTransform {
      return transform;
    },

    setTransform(next: ZoomTransform): void {
      commit(settle(next, options));
    },

    reset(): void {
      commit(identityZoom);
    },

    detach(): void {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointerleave', onUp);
      dispatcher.clear();
    },
  };
}
