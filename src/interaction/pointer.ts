import type { Point } from '../types/geometry.ts';
import { createDispatcher, type Dispatcher, type Unsubscribe } from './dispatcher.ts';

export interface PointerPayload {
  readonly point: Point;
  readonly local: Point;
  readonly originalEvent: PointerEvent;
}

export interface PointerEvents extends Record<string, unknown> {
  move: PointerPayload;
  enter: PointerPayload;
  leave: PointerPayload;
  down: PointerPayload;
  up: PointerPayload;
  click: PointerPayload;
}

export interface PointerOptions {
  readonly offset?: Point;
  readonly moveThreshold?: number;
}

export interface PointerSource extends Dispatcher<PointerEvents> {
  detach(): void;
}

export function localPoint(element: Element, event: { clientX: number; clientY: number }): Point {
  const bounds = element.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

export function attachPointer(
  element: Element,
  options: PointerOptions = {}
): PointerSource {
  const dispatcher = createDispatcher<PointerEvents>();
  const offset = options.offset ?? { x: 0, y: 0 };
  const threshold = options.moveThreshold ?? 0;
  let lastMove: Point | undefined;

  const payloadFor = (event: PointerEvent): PointerPayload => {
    const point = localPoint(element, event);
    return {
      point,
      local: { x: point.x - offset.x, y: point.y - offset.y },
      originalEvent: event,
    };
  };

  const onMove = (event: PointerEvent): void => {
    const payload = payloadFor(event);
    if (
      threshold > 0 &&
      lastMove &&
      Math.hypot(payload.point.x - lastMove.x, payload.point.y - lastMove.y) < threshold
    ) {
      return;
    }
    lastMove = payload.point;
    dispatcher.emit('move', payload);
  };

  const onEnter = (event: PointerEvent): void => {
    dispatcher.emit('enter', payloadFor(event));
  };

  const onLeave = (event: PointerEvent): void => {
    lastMove = undefined;
    dispatcher.emit('leave', payloadFor(event));
  };

  const onDown = (event: PointerEvent): void => {
    dispatcher.emit('down', payloadFor(event));
  };

  const onUp = (event: PointerEvent): void => {
    dispatcher.emit('up', payloadFor(event));
  };

  const onClick = (event: Event): void => {
    dispatcher.emit('click', payloadFor(event as PointerEvent));
  };

  element.addEventListener('pointermove', onMove as EventListener);
  element.addEventListener('pointerenter', onEnter as EventListener);
  element.addEventListener('pointerleave', onLeave as EventListener);
  element.addEventListener('pointerdown', onDown as EventListener);
  element.addEventListener('pointerup', onUp as EventListener);
  element.addEventListener('click', onClick);

  const detach = (): void => {
    element.removeEventListener('pointermove', onMove as EventListener);
    element.removeEventListener('pointerenter', onEnter as EventListener);
    element.removeEventListener('pointerleave', onLeave as EventListener);
    element.removeEventListener('pointerdown', onDown as EventListener);
    element.removeEventListener('pointerup', onUp as EventListener);
    element.removeEventListener('click', onClick);
    dispatcher.clear();
  };

  return { ...dispatcher, detach };
}

export function throttleToFrame<T>(handler: (payload: T) => void): {
  run: (payload: T) => void;
  cancel: Unsubscribe;
} {
  let queued: T | undefined;
  let frame = 0;

  const flush = (): void => {
    frame = 0;
    if (queued === undefined) return;
    const payload = queued;
    queued = undefined;
    handler(payload);
  };

  return {
    run(payload: T): void {
      queued = payload;
      if (frame !== 0) return;
      frame =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(flush)
          : (setTimeout(flush, 16) as unknown as number);
    },
    cancel(): void {
      if (frame === 0) return;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      else clearTimeout(frame);
      frame = 0;
      queued = undefined;
    },
  };
}
