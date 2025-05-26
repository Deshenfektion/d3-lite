# State and interaction

## Why a visualization library needs state at all

A static chart needs no state: data in, pixels out. Every interesting chart is not static.
Hovering highlights a mark. Clicking a legend hides a series. A brush filters a range and three
other charts follow. A live feed appends a sample every second.

Each of those is the same shape: _something changed, work out the smallest correct update._
Without a state layer that logic ends up smeared across event handlers, each one reaching into
the DOM and mutating it directly. That is how charts become unmaintainable — not because the
maths is hard, but because there is no single place that says what the chart currently is.

So: state holds the truth, the scene is derived from it, and the renderer reconciles.

## Signals

d3-lite uses fine-grained reactivity rather than a component tree with re-renders.

```ts
const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(doubled());
});

count.set(21); // effect logs 42
```

Reading a signal inside a tracked scope registers a dependency. That is the whole mechanism:
`track()` adds the node to the currently running computation, and dependencies are cleared and
rebuilt on every run, so they follow branches:

```ts
effect(() => {
  render(showDetail() ? detailData() : summaryData());
});
```

When `showDetail` is false this effect does not depend on `detailData` at all, and changing
`detailData` does not wake it.

### Push-pull and the diamond problem

The naive implementation — on write, eagerly notify every observer — is wrong in a way that is
easy to miss. Consider:

```
source ──► parity = source % 2 ──► effect
```

Setting `source` from 1 to 3 changes `source` but not `parity`. An eager implementation runs
the effect anyway, because it only knows that something upstream changed.

d3-lite versions every node. A write bumps the source's version and marks dependents stale
without recomputing. Before an effect runs, it _pulls_ each dependency — forcing stale computeds
to recompute — and compares the resulting versions against those recorded on its last run. A
computed bumps its version only when its new value differs under its equality function. If no
version moved, the effect is skipped.

The result is that derived state acts as a genuine barrier. This is asserted directly:
`source.set(3)` does not run the effect; `source.set(2)` does.

### Batching and scheduling

`batch()` defers the flush until the outermost batch exits, so ten writes cause one effect run.
Effects are queued and flushed through a scheduler, which is pluggable:

```ts
setScheduler((flush) => requestAnimationFrame(flush)); // coalesce to frames
setScheduler((flush) => flush()); // synchronous, for tests
```

Frame-scheduling matters for a chart: a pointer that fires 200 move events per second should
cause at most 60 renders, and coalescing at the scheduler means no component needs its own
throttle.

## Comparison with React state

The models solve the same problem at different granularities.

|                         | React                                 | d3-lite signals                                     |
| ----------------------- | ------------------------------------- | --------------------------------------------------- |
| Unit of change          | component                             | individual value                                    |
| On update               | re-run the component, diff its output | re-run only the effects that read the value         |
| Dependencies            | declared by hand in a deps array      | tracked automatically at read time                  |
| Stale derived values    | `useMemo`, invalidated by deps        | `computed`, invalidated by version                  |
| Skipping unchanged work | `React.memo`, `useMemo`               | free — unchanged version, no notification           |
| Cost model              | proportional to the tree re-rendered  | proportional to what actually depends on the change |

React's model is a good fit for UI trees, where components are the natural unit and the diff is
over elements you mostly did not write. A chart is different: one component owns thousands of
marks, so "re-render the component" means "rebuild 5,000 nodes", and the interesting question is
which handful of marks changed. Fine-grained tracking answers that question directly.

The comparison is not "signals are better". It is that the granularity should match the unit of
change, and in a visualization that unit is a value, not a component.

Using d3-lite inside React works fine: create the chart in an effect, call `chart.update()` when
props change, `chart.destroy()` on unmount. The two state systems do not fight because d3-lite
never re-renders React and React never rebuilds the scene.

## Stores

`createStore` wraps a signal holding an object, with shallow equality:

```ts
const store = createStore({ metric: 'revenue', limit: 10, highlight: null });

const metric = store.select((state) => state.metric); // memoised selector
store.patch({ limit: 20 }); // metric subscribers do not fire
```

`patch` compares field by field and does nothing if every value is identical, so an idempotent
update costs nothing. Selectors are cached by function identity, so passing the same selector
twice returns the same computed node rather than building a parallel graph.

## Interaction

Interaction is deliberately independent of rendering. Behaviours attach to an element, resolve
pointer positions into plot-local coordinates, and emit semantic events. They never touch the
scene.

```
pointer event → local coordinates → hit test → semantic event → state update → scene → DOM
```

### Hit testing

For a bar chart, SVG hit testing is free — the browser knows which rect is under the cursor. For
a scatter plot with thousands of points, "nearest point within 30px" is not something the DOM
answers, and testing every point per mousemove is O(n) per event.

`createQuadtree` recursively subdivides space, storing up to `capacity` points per node before
splitting. Nearest-neighbour search prunes any subtree whose bounding box is farther than the
best distance found so far.

Two implementation details worth stating because both were bugs first:

- **Depth must be tracked through subdivision.** Re-inserting points into a freshly split node
  has to carry the node's real depth, or the max-depth guard never fires and coincident points
  recurse until the stack gives out.
- **Ties must resolve deterministically.** Preferring the first-inserted point on an exact tie
  makes results reproducible and lets the search be verified against a brute-force scan.

The suite checks the quadtree against a linear scan over a grid of probe points, so correctness
does not rest on the structure looking plausible.

Measured over 20,000 points and 1,000 queries: **3.9 ms versus 234 ms** for the linear scan,
roughly 60× faster. That gap is the difference between a hover that tracks the cursor and one
that visibly lags.

### Behaviours

| Behaviour       | Emits                                           | Notes                                                          |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `attachPointer` | `move`, `enter`, `leave`, `down`, `up`, `click` | normalises to local coordinates, optional move threshold       |
| `attachHover`   | `enter`, `move`, `leave`, `select`              | quadtree-backed; `enter` fires once per mark, not per pixel    |
| `attachZoom`    | `start`, `zoom`, `end`                          | wheel and drag, axis-lockable, focus-preserving                |
| `attachBrush`   | `start`, `brush`, `end`, `clear`                | axis-constrained, clamped to extent, sub-threshold drags clear |
| `createTooltip` | —                                               | positioned overlay, flips near edges                           |

`attachHover` distinguishes `enter` from `move` by identity, so a tooltip is rebuilt when you
cross to a new mark and merely repositioned while you stay on one.

Every behaviour returns a `detach()` that removes its listeners and clears its dispatcher.
Charts return `destroy()`. Leaked listeners on a dashboard that swaps charts are a real bug
class, so teardown is part of the interface rather than an afterthought.

### Tooltips and colour

Tooltip label text uses the secondary ink token, never the series colour. A coloured swatch
carries the identity; the text stays readable. Values use `tabular-nums` so digits align.
