# Changelog

## 0.1.0 — 2025-05-28

First tagged release. The whole pipeline is in place and every layer has tests.

### Data

- RFC 4180 delimited tokenizer: quoted delimiters, doubled-quote escapes, embedded newlines,
  `\r\n` / `\n` / `\r`, BOM stripping, comment lines, row limits
- Delimiter auto-detection across `,`, `;`, tab and `|`, quote-aware
- Per-column type inference with widening (`null → boolean → number → date → string`), a
  configurable sample size and explicit overrides
- JSON parsing with nested flattening, array policies (`index` / `join` / `drop`), depth limits
  and record path selection
- Parsers report issues instead of throwing; ragged rows are padded and reported, duplicate
  headers renamed
- Schema inference and validation with error and warning severities
- Transform operators: `filter`, `map`, `derive`, `select`, `drop`, `rename`, `sortBy`, `limit`,
  `dropMissing`, `fillMissing`, `normalizeField`, `groupBy`, `summarize`, `countBy`, `bin`,
  `join`, `concat`, `fold`, `pivot`, `unnest`
- Composable `pipeline()` plus a chainable `Pipe` wrapper
- Lazy memoised column and `Float64Array` extraction

### Scales

- Shared continuous core with `bimap` / `polymap`, clamping, inversion and custom interpolators
- Linear, log (with decade and minor ticks), power, sqrt and time scales
- Ordinal, band, point, quantize and threshold scales
- Sequential, diverging and categorical colour scales
- Tick generation from the `1/2/5 × 10ⁿ` family, computed by division to avoid float drift
- `nice()` domain rounding that expands outward in both step regimes

### Colour

- sRGB, CIE Lab and HCL conversion
- Lab interpolation by default, HCL with shortest-path hue
- WCAG relative luminance, contrast ratio and readable-text selection
- A validated eight-slot categorical palette in light and dark, with a documented all-pairs cap

### Rendering

- Inert scene graph with stable keys and attached data
- Keyed reconciliation emitting `create` / `update` / `move` / `remove`, moving only nodes below
  the highest-previous-index watermark
- SVG backend with attribute-level change detection and instrumentation counters
- Canvas backend sharing the same renderer contract

### State

- Signals, computed values and effects with dynamic dependency tracking
- Version-based push-pull propagation, so unchanged derived values do not wake effects
- Batching and a pluggable scheduler
- Stores with shallow-equality patching and memoised selectors

### Interaction

- Typed event dispatcher
- Quadtree spatial index with depth-capped subdivision and deterministic tie-breaking
- Pointer source with local-coordinate normalisation and move thresholds
- Hover behaviour distinguishing enter from move by identity
- Tooltip overlay with edge flipping
- Zoom and pan with focus-preserving scaling
- Brush selection with axis constraint and domain conversion

### Components

- Chart shell owning space, renderer, store, reactive rendering, resize, theming and teardown
- Axis, grid, legend, value-label and mark scene builders
- Bar (single, grouped, stacked, horizontal), line, area, scatter and histogram charts
- Encoding channels mapping fields, constants and accessors to visual properties

### Examples

- Sales dashboard, quality metrics, time-series analytics and dataset explorer
- Seeded fixture generator for reproducible data

### Tooling

- 437 tests, including end-to-end example smoke tests
- Two benchmark harnesses with a committed results report
- Strict TypeScript, ESLint flat config, Prettier
