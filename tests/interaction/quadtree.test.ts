import { describe, expect, it } from 'vitest';
import { createQuadtree, quadtreeFrom, type QuadPoint } from '@/interaction/quadtree.ts';

const bounds = { x: 0, y: 0, width: 100, height: 100 };

const grid: QuadPoint<string>[] = [];
for (let x = 0; x < 10; x++) {
  for (let y = 0; y < 10; y++) {
    grid.push({ x: x * 10, y: y * 10, datum: `${x}-${y}` });
  }
}

describe('createQuadtree', () => {
  it('stores inserted points', () => {
    const tree = createQuadtree<string>(bounds);
    tree.add({ x: 10, y: 10, datum: 'a' });
    expect(tree.size()).toBe(1);
  });

  it('ignores points outside its bounds', () => {
    const tree = createQuadtree<string>(bounds);
    tree.add({ x: 500, y: 500, datum: 'far' });
    expect(tree.size()).toBe(0);
  });

  it('subdivides once capacity is exceeded', () => {
    const shallow = quadtreeFrom(grid.slice(0, 4), bounds, 8);
    const deep = quadtreeFrom(grid, bounds, 4);
    expect(deep.depth()).toBeGreaterThan(shallow.depth());
  });

  it('finds the nearest point', () => {
    const tree = quadtreeFrom(grid, bounds);
    expect(tree.find(31, 29)?.datum).toBe('3-3');
  });

  it('agrees with a linear scan', () => {
    const tree = quadtreeFrom(grid, bounds);
    for (const probe of [
      { x: 0, y: 0 },
      { x: 55, y: 12 },
      { x: 99, y: 99 },
      { x: 47, y: 83 },
    ]) {
      let best = grid[0]!;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const point of grid) {
        const distance = Math.hypot(point.x - probe.x, point.y - probe.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = point;
        }
      }
      expect(tree.find(probe.x, probe.y)?.datum).toBe(best.datum);
    }
  });

  it('respects the search radius', () => {
    const tree = quadtreeFrom([{ x: 50, y: 50, datum: 'only' }], bounds);
    expect(tree.find(0, 0, 10)).toBeUndefined();
    expect(tree.find(52, 52, 10)?.datum).toBe('only');
  });

  it('returns undefined when empty', () => {
    expect(createQuadtree<string>(bounds).find(5, 5)).toBeUndefined();
  });

  it('collects points inside an area', () => {
    const tree = quadtreeFrom(grid, bounds);
    const inside = tree.within({ x: 0, y: 0, width: 25, height: 25 });
    expect(inside).toHaveLength(9);
  });

  it('returns nothing for a disjoint area', () => {
    const tree = quadtreeFrom(grid, bounds);
    expect(tree.within({ x: 200, y: 200, width: 10, height: 10 })).toEqual([]);
  });

  it('handles many coincident points without exceeding max depth', () => {
    const tree = createQuadtree<number>(bounds, 2);
    for (let i = 0; i < 200; i++) tree.add({ x: 10, y: 10, datum: i });
    expect(tree.size()).toBe(200);
    expect(tree.depth()).toBeLessThanOrEqual(13);
    expect(tree.find(10, 10)).toBeDefined();
  });

  it('exposes its bounds', () => {
    expect(createQuadtree<string>(bounds).bounds()).toEqual(bounds);
  });
});
