import { bench, describe } from 'vitest';
import { createSvgRenderer } from '@/renderer/svg.ts';
import { group, rect } from '@/renderer/scene.ts';
import { diffChildren } from '@/renderer/diff.ts';
import { quadtreeFrom } from '@/interaction/quadtree.ts';
import { seededRandom } from './harness.ts';

const random = seededRandom(7);

const scene = (count: number, offset: number) =>
  group(
    { key: 'root' },
    Array.from({ length: count }, (_, i) =>
      rect(`bar-${i}`, {
        x: i * 3,
        y: (i + offset) % 400,
        width: 2,
        height: 40,
        fill: '#2a78d6',
      })
    )
  );

describe('scene diffing', () => {
  const a = scene(2000, 0);
  const b = scene(2000, 0);
  const c = scene(2000, 1);

  bench('diff identical 2000 marks', () => {
    diffChildren(a.children ?? [], b.children ?? []);
  });

  bench('diff all-changed 2000 marks', () => {
    diffChildren(a.children ?? [], c.children ?? []);
  });
});

describe('svg rendering', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = createSvgRenderer(container, { width: 720, height: 400 });
  const stable = scene(2000, 0);
  renderer.render(stable);

  bench('re-render unchanged 2000 marks', () => {
    renderer.render(stable);
  });

  let generation = 0;
  bench('re-render fully changed 2000 marks', () => {
    generation++;
    renderer.render(scene(2000, generation % 5));
  });
});

describe('hit testing', () => {
  const points = Array.from({ length: 10000 }, (_, i) => ({
    x: random() * 1000,
    y: random() * 1000,
    datum: i,
  }));
  const tree = quadtreeFrom(points, { x: 0, y: 0, width: 1000, height: 1000 });

  bench('quadtree 500 nearest queries', () => {
    for (let i = 0; i < 500; i++) tree.find(random() * 1000, random() * 1000, 40);
  });

  bench('linear 500 nearest queries', () => {
    for (let q = 0; q < 500; q++) {
      const px = random() * 1000;
      const py = random() * 1000;
      let best = Number.POSITIVE_INFINITY;
      for (const point of points) {
        const distance = Math.hypot(point.x - px, point.y - py);
        if (distance < best) best = distance;
      }
    }
  });
});
