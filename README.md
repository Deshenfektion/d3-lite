# d3-lite

D3-inspired visualization engine, written from scratch in TypeScript. Zero runtime dependencies.

Not a D3 replacement. It's a rebuild of what's actually inside a charting library — parser, scales, a keyed-diffing scene graph, reactive state, interaction layer — small enough to read end to end.

```ts
import { parseCSV, barChart } from 'd3-lite';

const { dataset } = parseCSV(csvText);

barChart(document.querySelector('#chart'), {
  data: dataset,
  x: 'region',
  y: 'revenue',
  series: 'segment',
});
```

## Layout

```
src/
  data/         CSV/JSON parsing, schema inference, transforms
  scales/       linear, log, pow, sqrt, time, ordinal, band, point,
                sequential and diverging color
  color/        sRGB/Lab/HCL conversion, interpolation, validated palettes
  coords/       cartesian space, margins, zoom transforms
  shape/        paths, curves, symbols
  layout/       bar, stack, grouped-band layout
  renderer/     scene graph, keyed diffing, SVG + Canvas backends
  state/        signals, computed values, batched effects
  interaction/  quadtree hit-testing, hover, tooltip, zoom, brush
  components/   axes, legends, chart shell, chart types
```

Dependencies point one way — scales don't know a renderer exists. Full write-up per layer in [`docs/`](./docs).

## Charts

Bar (stacked/grouped), line, area, scatter, histogram. Adding one is a layer-builder + options interface — no changes to the renderer, scales, or state.

## Run it

```bash
npm install
npm run dev             # examples, prints a URL
npm test                # 437 tests
npm run typecheck
npm run lint
npm run bench:report
npm run build
```

Node 20.11+.

## Numbers

Measured with `npm run bench:report` (Node 24, Apple Silicon, jsdom — absolute numbers are optimistic, ratios are the transferable part):

|                                                      | Result                     |
| ---------------------------------------------------- | -------------------------- |
| SVG update, 5k marks, targeted patch vs full repaint | 0.94 ms vs 13.24 ms (~14×) |
| Quadtree vs linear scan, 20k points, 1k queries      | 3.9 ms vs 233.7 ms (~60×)  |
| Parse 20k-row CSV with type inference                | 21.2 ms                    |

Diff cost is still O(n) — the win is fewer DOM writes, not less traversal. Full numbers in [`docs/performance.md`](./docs/performance.md).

## What's missing

No polar/geo/hierarchical layouts, no transitions, no streaming parse, no keyboard nav. Text measurement is estimated, not real glyph metrics. Full list in [`docs/architecture.md`](./docs/architecture.md).

## License

MIT
