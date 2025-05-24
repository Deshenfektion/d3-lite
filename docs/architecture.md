# Architecture

d3-lite is organised as a one-way pipeline. Each stage has a single responsibility, knows
nothing about the stages after it, and can be used on its own.

```
Raw input (CSV / TSV / JSON / object arrays)
        │
        ▼
  Parser            tokenize, infer types, coerce values
        │
        ▼
  Dataset           rows + schema, the common internal representation
        │
        ▼
  Transform         filter, derive, group, aggregate, bin, join, reshape
        │
        ▼
  Encoding          data fields → visual channels
        │
        ▼
  Scales            domain values → range values
        │
        ▼
  Coordinate space  margins, plot rect, screen conversion
        │
        ▼
  Layout            bar rects, stack offsets, path geometry
        │
        ▼
  Scene graph       an immutable description of what should be on screen
        │
        ▼
  Renderer          diff against the previous scene, patch the DOM
        │
        ▼
  Interaction       pointer → hit test → semantic events → state
        │
        └──────────► State ──► (re-enters at Transform)
```

The loop at the bottom is the important part. Interaction never mutates the DOM. It writes to
state; state invalidates the scene; the renderer works out the smallest DOM change that
realises the new scene.

## Module map

| Module               | Responsibility                                             | Depends on                |
| -------------------- | ---------------------------------------------------------- | ------------------------- |
| `src/types`          | Shared type contracts                                      | —                         |
| `src/utils`          | Arrays, statistics, tick maths, formatting, guards         | types                     |
| `src/data/parser`    | CSV/TSV tokenizer, JSON flattening, type inference         | types, utils              |
| `src/data/schema`    | Schema inference and validation                            | types, utils              |
| `src/data/transform` | Composable dataset operators                               | data, utils               |
| `src/interpolate`    | Numeric and piecewise interpolators                        | —                         |
| `src/color`          | sRGB/Lab/HCL conversion, interpolation, palettes           | utils, interpolate        |
| `src/scales`         | Continuous, discrete and colour scales                     | utils, interpolate, color |
| `src/coords`         | Cartesian space, margins, zoom transforms                  | types, utils, scales      |
| `src/shape`          | Path generation, curves, symbols                           | types, utils              |
| `src/layout`         | Bars, stacks, grouped bands                                | types, scales             |
| `src/encode`         | Channel and encoding resolution                            | types, utils              |
| `src/renderer`       | Scene graph, keyed diff, SVG and Canvas backends           | types, renderer           |
| `src/state`          | Signals, computed values, effects, stores                  | utils                     |
| `src/interaction`    | Dispatcher, quadtree, pointer, hover, tooltip, zoom, brush | types, coords, scales     |
| `src/components`     | Axes, legends, marks, chart shell, chart types             | everything above          |

Dependencies only point downward. `src/scales` does not know that a renderer exists;
`src/renderer` does not know what a scale is. The only module that sees the whole stack is
`src/components`.

## Why these boundaries

**Parsing is separate from the dataset.** A parser produces a `ParseResult` — a dataset plus a
list of issues. Nothing throws on malformed input. A chart can render 9,998 good rows and
report 2 bad ones, which is what you want when a colleague hands you a CSV export.

**The dataset is the narrow waist.** Every input format converges on `{ rows, schema }`. Every
transform takes a dataset and returns a dataset. This is what makes `pipeline(...)` possible
and what lets the explorer example accept pasted data and chart it without special cases.

**Scales are standalone functions with getter/setter accessors.** They follow D3's shape
(`scale.domain([0, 100]).range([0, 720])`) because that design is genuinely good: the scale is
callable, configuration is chainable, and `copy()` makes it cheap to derive a zoomed variant.

**The scene graph decouples "what to draw" from "how to draw it".** Components build a tree of
plain objects. That tree can be diffed, asserted against in tests without a DOM, rendered to
SVG, or rendered to Canvas. Most component tests in this repo never touch the DOM — they
inspect the scene.

**Interaction is independent of rendering.** `attachHover` needs an element to listen on and a
list of positioned data points. It does not care whether those points are SVG circles or Canvas
pixels. This is the only design that works once you have two rendering backends.

## Lifecycle of a chart

1. `createChart` resolves a `CartesianSpace` from width, height and margins, creates a
   renderer, and creates a store seeded with the initial state.
2. It registers an `effect` that reads the store and calls the layer builders.
3. Each layer builder is a pure function `(state, context) => SceneNode`.
4. The resulting scene is handed to the renderer, which diffs and patches.
5. `chart.update(partial)` patches the store. If the patch changes nothing, the effect does not
   re-run. If it does, steps 3–4 repeat.
6. `chart.destroy()` disposes the effect and detaches the root element.

Adding a new chart type means writing layer builders and a small options interface. It does not
mean touching the renderer, the scales, or the state system.

## Testing strategy

- **Pure layers** (utils, scales, transforms, shape, layout, encode) are tested as functions.
- **Scene builders** (axis, legend, marks) are tested by asserting on the scene tree.
- **Renderers** are tested against jsdom for SVG and against a recording context for Canvas.
- **Interaction** is tested by dispatching synthetic pointer events.
- **Examples** are smoke-tested end to end: the real HTML is mounted, `fetch` is stubbed with
  the real fixture files, and the example's entry module is imported and asserted on.

That last category exists because typechecking an example proves nothing about whether it runs.
