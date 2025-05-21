import { JSDOM } from 'jsdom';
import { benchmark, formatResults, seededRandom, type BenchResult } from './harness.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
globals.Element = dom.window.Element;
globals.SVGElement = dom.window.SVGElement;
globals.Node = dom.window.Node;

const { parseCSV } = await import('../src/data/parser/csv.ts');
const { createDataset } = await import('../src/data/dataset.ts');
const { groupBy } = await import('../src/data/transform/aggregate.ts');
const { sortBy, filter } = await import('../src/data/transform/basics.ts');
const { pipeline } = await import('../src/data/transform/pipeline.ts');
const { scaleLinear } = await import('../src/scales/linear.ts');
const { scaleBand } = await import('../src/scales/band.ts');
const { scaleSequentialColor } = await import('../src/scales/color.ts');
const { createSvgRenderer } = await import('../src/renderer/svg.ts');
const { group, rect } = await import('../src/renderer/scene.ts');
const { diffChildren } = await import('../src/renderer/diff.ts');
const { quadtreeFrom } = await import('../src/interaction/quadtree.ts');
const { signal, computed, effect, flushSync, setScheduler } = await import(
  '../src/state/signal.ts'
);
const { linePath } = await import('../src/shape/line.ts');

const random = seededRandom(424242);
const results: BenchResult[] = [];

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const SEGMENTS = ['Enterprise', 'Mid', 'SMB'];

const csvRows: string[] = ['region,segment,month,revenue,units'];
for (let i = 0; i < 20000; i++) {
  csvRows.push(
    [
      REGIONS[i % REGIONS.length],
      SEGMENTS[i % SEGMENTS.length],
      `2025-${String((i % 12) + 1).padStart(2, '0')}`,
      (random() * 1000).toFixed(2),
      Math.round(random() * 500),
    ].join(',')
  );
}
const csvText = csvRows.join('\n');

results.push(
  benchmark('parse csv (20k rows, type inference)', () => parseCSV(csvText), {
    iterations: 30,
  })
);

const parsed = parseCSV(csvText).dataset;

results.push(
  benchmark(
    'groupBy + sort (20k rows)',
    () => {
      pipeline(
        filter((row) => Number(row.revenue) > 100),
        groupBy(
          ['region', 'segment'],
          [
            { as: 'revenue', op: 'sum', field: 'revenue' },
            { as: 'units', op: 'mean', field: 'units' },
          ]
        ),
        sortBy([{ field: 'revenue', direction: 'desc' }])
      )(parsed);
    },
    { iterations: 40 }
  )
);

const linear = scaleLinear({ domain: [0, 1000], range: [0, 720] });
results.push(
  benchmark(
    'linear scale (100k projections)',
    () => {
      let sink = 0;
      for (let i = 0; i < 100000; i++) sink += linear(i % 1000);
      if (sink < 0) throw new Error('unreachable');
    },
    { iterations: 40 }
  )
);

const band = scaleBand({ domain: REGIONS, range: [0, 720], padding: 0.2 });
results.push(
  benchmark(
    'band scale (100k lookups)',
    () => {
      let sink = 0;
      for (let i = 0; i < 100000; i++) sink += band(REGIONS[i % REGIONS.length] as string);
      if (sink < 0) throw new Error('unreachable');
    },
    { iterations: 40 }
  )
);

const colorScale = scaleSequentialColor({ domain: [0, 100] });
results.push(
  benchmark(
    'sequential color scale (10k lab interpolations)',
    () => {
      for (let i = 0; i < 10000; i++) colorScale(i % 100);
    },
    { iterations: 30 }
  )
);

const points = Array.from({ length: 5000 }, () => ({
  x: random() * 720,
  y: random() * 400,
}));
results.push(
  benchmark(
    'line path generation (5k points, monotone)',
    () => linePath(points, { curve: 'monotoneX' }),
    { iterations: 60 }
  )
);

const buildScene = (count: number, seed: number) =>
  group(
    { key: 'root' },
    Array.from({ length: count }, (_, i) =>
      rect(`bar-${i}`, {
        x: i * 3,
        y: (i * seed) % 400,
        width: 2,
        height: 40 + ((i * seed) % 60),
        fill: '#2a78d6',
      })
    )
  );

for (const count of [1000, 5000]) {
  const before = buildScene(count, 7);
  const after = buildScene(count, 7);
  results.push(
    benchmark(
      `scene diff, no changes (${count} marks)`,
      () => diffChildren(before.children ?? [], after.children ?? []),
      {
        iterations: 100,
      }
    )
  );
}

const container = dom.window.document.createElement('div');
dom.window.document.body.appendChild(container);
const renderer = createSvgRenderer(container, { width: 720, height: 400 });

for (const count of [1000, 5000]) {
  const initial = buildScene(count, 7);
  renderer.render(initial);

  results.push(
    benchmark(
      `svg render, unchanged scene (${count} marks)`,
      () => {
        renderer.render(initial);
      },
      {
        iterations: 100,
      }
    )
  );

  let toggle = 0;
  results.push(
    benchmark(
      `svg render, one mark changed (${count} marks)`,
      () => {
        toggle = (toggle + 1) % 2;
        const children = [...(initial.children ?? [])];
        children[0] = rect('bar-0', {
          x: 0,
          y: toggle,
          width: 2,
          height: 40,
          fill: '#2a78d6',
        });
        renderer.render(group({ key: 'root' }, children));
      },
      { iterations: 100 }
    )
  );

  let generation = 0;
  results.push(
    benchmark(
      `svg render, full repaint (${count} marks)`,
      () => {
        generation++;
        renderer.render(buildScene(count, 7 + (generation % 3)));
      },
      { iterations: 40 }
    )
  );
}

const quadPoints = Array.from({ length: 20000 }, (_, i) => ({
  x: random() * 1000,
  y: random() * 1000,
  datum: i,
}));
const tree = quadtreeFrom(quadPoints, { x: 0, y: 0, width: 1000, height: 1000 });

results.push(
  benchmark(
    'quadtree nearest (20k points, 1k queries)',
    () => {
      for (let i = 0; i < 1000; i++) tree.find(random() * 1000, random() * 1000, 50);
    },
    { iterations: 30 }
  )
);

results.push(
  benchmark(
    'linear nearest scan (20k points, 1k queries)',
    () => {
      for (let q = 0; q < 1000; q++) {
        const px = random() * 1000;
        const py = random() * 1000;
        let best = Number.POSITIVE_INFINITY;
        for (const point of quadPoints) {
          const distance = Math.hypot(point.x - px, point.y - py);
          if (distance < best) best = distance;
        }
      }
    },
    { iterations: 3 }
  )
);

setScheduler((flush) => {
  flush();
});
const source = signal(0);
const derived = computed(() => source() * 2);
const chain = computed(() => derived() + 1);
effect(() => {
  chain();
});

results.push(
  benchmark(
    'signal write + flush (10k updates through 2 computeds)',
    () => {
      for (let i = 0; i < 10000; i++) {
        source.set(i);
        flushSync();
      }
    },
    { iterations: 20 }
  )
);

const wide = createDataset(
  Array.from({ length: 50000 }, (_, i) => ({
    id: i,
    value: random() * 100,
    category: REGIONS[i % REGIONS.length] as string,
  }))
);

results.push(
  benchmark(
    'aggregate 50k rows into 5 groups',
    () => groupBy(['category'], [{ as: 'total', op: 'sum', field: 'value' }])(wide),
    { iterations: 30 }
  )
);

process.stdout.write(`\nd3-lite benchmarks\n`);
process.stdout.write(`node ${process.version} · ${process.platform} ${process.arch}\n\n`);
process.stdout.write(`${formatResults(results)}\n\n`);
process.stdout.write(
  'Rendering figures are jsdom DOM mutation costs, not browser layout or paint.\n'
);
