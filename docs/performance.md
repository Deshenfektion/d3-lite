# Performance

All numbers here come from `npm run bench:report` on one machine — Node 24, Apple Silicon,
jsdom. They are relative signals, not absolutes, and the caveats at the bottom matter.

## Where the time goes

| Benchmark                                       | Mean     |
| ----------------------------------------------- | -------- |
| Parse 20k-row CSV with type inference           | 21.2 ms  |
| Group + sort 20k rows                           | 3.9 ms   |
| Aggregate 50k rows into 5 groups                | 4.3 ms   |
| Linear scale, 100k projections                  | 0.38 ms  |
| Band scale, 100k lookups                        | 0.93 ms  |
| Sequential colour scale, 10k Lab interpolations | 1.40 ms  |
| Monotone path, 5k points                        | 6.12 ms  |
| Scene diff, 1k marks unchanged                  | 0.11 ms  |
| Scene diff, 5k marks unchanged                  | 0.75 ms  |
| SVG re-render, 1k marks unchanged               | 0.13 ms  |
| SVG re-render, 1k marks, one changed            | 0.15 ms  |
| SVG full repaint, 1k marks                      | 2.30 ms  |
| SVG re-render, 5k marks unchanged               | 0.94 ms  |
| SVG re-render, 5k marks, one changed            | 0.91 ms  |
| SVG full repaint, 5k marks                      | 13.24 ms |
| Quadtree nearest, 20k points, 1k queries        | 3.9 ms   |
| Linear nearest scan, same workload              | 233.7 ms |
| 10k signal writes through 2 computeds           | 5.1 ms   |

## What is actually fast, and why

**Targeted patching beats repainting: ~14× at 5,000 marks.** 0.94 ms versus 13.24 ms. This is
the central claim of the rendering design and it holds up.

**The diff is not free.** Diffing 5,000 unchanged marks costs 0.75 ms of the 0.94 ms. The walk
is O(n) whether or not anything changed, which is why "unchanged" and "one mark changed" measure
the same. The saving is entirely in avoided DOM writes, not in avoided traversal. Anyone
claiming a keyed diff makes updates free is measuring the wrong thing.

**Quadtree hit testing: ~60×.** 3.9 ms versus 233.7 ms for 1,000 nearest-neighbour queries over
20,000 points. Below a few hundred points a linear scan is fine and simpler; the structure earns
its keep in the thousands.

**Scales are not a bottleneck.** 100,000 linear projections in 0.38 ms is about 260 million
per second — the closure composition costs essentially nothing after JIT warmup. Optimising
scales would be wasted effort.

**Colour is the expensive scale.** 10,000 Lab interpolations take 1.40 ms, roughly 30× the cost
of a linear projection, because each one runs sRGB → linear → XYZ → Lab, interpolates, and
reverses it. That is a fine price for perceptually even ramps at legend and per-mark scale. It
would not be fine per-pixel, which is what a ramp cache would fix if a heatmap ever needed one.

**Parsing dominates load.** 21 ms for 20,000 rows is by far the largest single cost in a cold
render. Most of it is unavoidable string work; the sampling limit on type inference (200 rows
by default) is what keeps it from being worse.

## Techniques used

**Attribute-level change detection.** The SVG renderer keeps a shadow copy of what it last wrote
and calls `setAttribute` only on a real difference. Asserted by test: 500 marks with one changed
value produces exactly one attribute write.

**Reference equality short-circuits.** `nodeUnchanged` checks identity before comparing fields,
so memoised subtrees cost one pointer comparison.

**Minimal moves.** The reconciler tracks the highest previous index seen and only moves nodes
that fall below that watermark, so appending moves nothing and reversing moves n−1.

**Lazy memoised columns.** `columnOf` and `numericColumn` extract a field once per dataset and
cache it in a `WeakMap`. Datasets are immutable, so the cache cannot go stale, and it is
collected with the dataset.

**Typed arrays for numeric columns.** `Float64Array` instead of boxed numbers for repeated
numeric scans.

**Welford's algorithm** for variance and standard deviation: one pass, no intermediate array,
numerically stable.

**Version-based reactivity.** A derived value whose result did not change does not notify. This
turns "highlight moved from bar 3 to bar 4" into two mark updates rather than a rebuild.

**Batched flushes.** `batch()` collapses multiple writes into one effect run; the scheduler is
pluggable so a chart can coalesce to `requestAnimationFrame`.

**Allocation discipline in hot paths.** Loops pre-size arrays with `new Array(n)`, path builders
append to a single string, and the tokenizer reads `charCodeAt` rather than slicing.

## Caveats

**jsdom is not a browser.** It implements the DOM API without style resolution, layout or paint.
A real browser does considerably more work per mutation, so absolute figures are optimistic. The
_ratios_ transfer, and they understate the benefit if anything, since the work a patch avoids is
the expensive part in a real browser.

**One machine, one Node version.** Apple Silicon, Node 24. Different hardware will differ.

**Microbenchmarks flatter JIT-friendly code.** Tight loops over the same shapes optimise better
than real application code with polymorphic call sites.

**No paint or layout is measured anywhere.** Nothing here says how long a browser takes to put
pixels on screen. Measuring that needs a real browser and frame instrumentation, which this
repo does not have.

**Not compared against D3.** Doing that honestly means matching feature-for-feature on identical
workloads, and d3-lite implements a subset. An unmatched comparison would be marketing, not
measurement.

## What would come next

In rough order of expected return:

1. **Dirty-subtree marking.** The O(n) walk is the floor on update cost. Letting a group declare
   itself unchanged would let the diff skip whole branches and turn "unchanged scene" into
   nearly free.
2. **Canvas for high-cardinality marks.** Past roughly 10,000 marks the DOM node count itself
   dominates. The Canvas backend exists; the components do not yet choose it automatically.
3. **Streaming parse.** 21 ms blocks the main thread. Chunked parsing, or moving it to a worker,
   would keep the first frame responsive on large files.
4. **Colour ramp caching.** Quantising a sequential scale into ~256 precomputed steps would make
   colour lookups as cheap as any other scale, which matters if heatmaps arrive.
5. **Scale result caching for repeated categoricals.** Band lookups already go through a `Map`;
   caching per-render projections would help charts that re-project the same values across
   layers.
