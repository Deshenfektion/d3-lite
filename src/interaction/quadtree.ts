import type { Rect } from '../types/geometry.ts';

export interface QuadPoint<T> {
  readonly x: number;
  readonly y: number;
  readonly datum: T;
}

interface QuadNode<T> {
  bounds: Rect;
  points: QuadPoint<T>[];
  children?: [QuadNode<T>, QuadNode<T>, QuadNode<T>, QuadNode<T>];
}

export interface Quadtree<T> {
  add(point: QuadPoint<T>): void;
  find(x: number, y: number, maxDistance?: number): QuadPoint<T> | undefined;
  within(area: Rect): QuadPoint<T>[];
  size(): number;
  depth(): number;
  bounds(): Rect;
}

const DEFAULT_CAPACITY = 8;
const MAX_DEPTH = 12;

function contains(bounds: Rect, x: number, y: number): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return !(
    b.x > a.x + a.width ||
    b.x + b.width < a.x ||
    b.y > a.y + a.height ||
    b.y + b.height < a.y
  );
}

function distanceToRect(bounds: Rect, x: number, y: number): number {
  const dx = Math.max(bounds.x - x, 0, x - (bounds.x + bounds.width));
  const dy = Math.max(bounds.y - y, 0, y - (bounds.y + bounds.height));
  return Math.hypot(dx, dy);
}

export function createQuadtree<T>(
  bounds: Rect,
  capacity = DEFAULT_CAPACITY
): Quadtree<T> {
  const root: QuadNode<T> = { bounds, points: [] };
  let count = 0;

  const subdivide = (node: QuadNode<T>, depth: number): void => {
    const halfWidth = node.bounds.width / 2;
    const halfHeight = node.bounds.height / 2;
    const { x, y } = node.bounds;

    node.children = [
      { bounds: { x, y, width: halfWidth, height: halfHeight }, points: [] },
      { bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight }, points: [] },
      { bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight }, points: [] },
      {
        bounds: {
          x: x + halfWidth,
          y: y + halfHeight,
          width: halfWidth,
          height: halfHeight,
        },
        points: [],
      },
    ];

    const existing = node.points;
    node.points = [];
    for (const point of existing) insertInto(node, point, depth);
  };

  const insertInto = (node: QuadNode<T>, point: QuadPoint<T>, depth: number): void => {
    if (node.children) {
      for (const child of node.children) {
        if (contains(child.bounds, point.x, point.y)) {
          insertInto(child, point, depth + 1);
          return;
        }
      }
      node.points.push(point);
      return;
    }

    node.points.push(point);
    if (node.points.length > capacity && depth < MAX_DEPTH) subdivide(node, depth);
  };

  const measureDepth = (node: QuadNode<T>): number => {
    if (!node.children) return 1;
    let deepest = 0;
    for (const child of node.children) deepest = Math.max(deepest, measureDepth(child));
    return deepest + 1;
  };

  return {
    add(point: QuadPoint<T>): void {
      if (!contains(root.bounds, point.x, point.y)) return;
      insertInto(root, point, 0);
      count++;
    },

    find(x: number, y: number, maxDistance = Number.POSITIVE_INFINITY): QuadPoint<T> | undefined {
      let best: QuadPoint<T> | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;

      const visit = (node: QuadNode<T>): void => {
        if (distanceToRect(node.bounds, x, y) > Math.min(bestDistance, maxDistance)) return;

        for (const point of node.points) {
          const distance = Math.hypot(point.x - x, point.y - y);
          if (distance > maxDistance) continue;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = point;
          }
        }

        if (!node.children) return;
        for (const child of node.children) visit(child);
      };

      visit(root);
      return best;
    },

    within(area: Rect): QuadPoint<T>[] {
      const out: QuadPoint<T>[] = [];

      const visit = (node: QuadNode<T>): void => {
        if (!intersects(node.bounds, area)) return;
        for (const point of node.points) {
          if (contains(area, point.x, point.y)) out.push(point);
        }
        if (!node.children) return;
        for (const child of node.children) visit(child);
      };

      visit(root);
      return out;
    },

    size(): number {
      return count;
    },

    depth(): number {
      return measureDepth(root);
    },

    bounds(): Rect {
      return root.bounds;
    },
  };
}

export function quadtreeFrom<T>(
  points: readonly QuadPoint<T>[],
  bounds: Rect,
  capacity = DEFAULT_CAPACITY
): Quadtree<T> {
  const tree = createQuadtree<T>(bounds, capacity);
  for (const point of points) tree.add(point);
  return tree;
}
