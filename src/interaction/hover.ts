import type { Point, Rect } from '../types/geometry.ts';
import { createDispatcher, type Dispatcher } from './dispatcher.ts';
import { attachPointer, type PointerSource } from './pointer.ts';
import { quadtreeFrom, type QuadPoint, type Quadtree } from './quadtree.ts';

export interface HoverTarget<T> {
  readonly datum: T;
  readonly point: Point;
  readonly pointer: Point;
  readonly distance: number;
}

export interface HoverEvents<T> extends Record<string, unknown> {
  enter: HoverTarget<T>;
  move: HoverTarget<T>;
  leave: undefined;
  select: HoverTarget<T>;
}

export interface HoverOptions<T> {
  readonly points: readonly QuadPoint<T>[];
  readonly bounds: Rect;
  readonly radius?: number;
  readonly offset?: Point;
  readonly identify?: (datum: T) => string;
}

export interface HoverBehavior<T> extends Dispatcher<HoverEvents<T>> {
  update(points: readonly QuadPoint<T>[]): void;
  current(): T | undefined;
  tree(): Quadtree<T>;
  detach(): void;
}

const DEFAULT_RADIUS = 32;

export function attachHover<T>(element: Element, options: HoverOptions<T>): HoverBehavior<T> {
  const dispatcher = createDispatcher<HoverEvents<T>>();
  const radius = options.radius ?? DEFAULT_RADIUS;
  const identify = options.identify ?? ((datum: T) => JSON.stringify(datum));

  let tree = quadtreeFrom(options.points, options.bounds);
  let activeKey: string | undefined;
  let activeDatum: T | undefined;

  const pointer: PointerSource = attachPointer(element, {
    ...(options.offset === undefined ? {} : { offset: options.offset }),
  });

  const clear = (): void => {
    if (activeKey === undefined) return;
    activeKey = undefined;
    activeDatum = undefined;
    dispatcher.emit('leave', undefined);
  };

  const resolve = (local: Point): HoverTarget<T> | undefined => {
    const found = tree.find(local.x, local.y, radius);
    if (!found) return undefined;
    return {
      datum: found.datum,
      point: { x: found.x, y: found.y },
      pointer: local,
      distance: Math.hypot(found.x - local.x, found.y - local.y),
    };
  };

  pointer.on('move', ({ local }) => {
    const target = resolve(local);
    if (!target) {
      clear();
      return;
    }
    const key = identify(target.datum);
    if (key !== activeKey) {
      activeKey = key;
      activeDatum = target.datum;
      dispatcher.emit('enter', target);
    }
    dispatcher.emit('move', target);
  });

  pointer.on('leave', clear);

  pointer.on('click', ({ local }) => {
    const target = resolve(local);
    if (target) dispatcher.emit('select', target);
  });

  return {
    ...dispatcher,

    update(points: readonly QuadPoint<T>[]): void {
      tree = quadtreeFrom(points, options.bounds);
      clear();
    },

    current(): T | undefined {
      return activeDatum;
    },

    tree(): Quadtree<T> {
      return tree;
    },

    detach(): void {
      pointer.detach();
      dispatcher.clear();
    },
  };
}
