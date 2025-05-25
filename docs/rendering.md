# The rendering engine

## The problem

The naive way to update a chart is to clear the container and rebuild it. It is easy to write
and it is correct. It is also the reason charts feel sluggish: every element is destroyed and
recreated on every frame, even the 4,999 bars that did not change.

D3 solves this with the data join — `enter`, `update`, `exit` — which is a brilliant idea tied
to a specific selection API. d3-lite takes the same underlying insight (identify elements by
key, touch only what changed) and expresses it as a scene graph diff, which is easier to test
and works for more than one backend.

## The scene graph

Components do not touch the DOM. They build a tree of plain objects:

```ts
interface SceneNode {
  type: 'group' | 'rect' | 'circle' | 'line' | 'path' | 'text';
  key: string; // identity across frames
  attrs: Record<string, Attr>;
  text?: string;
  transform?: ZoomTransform;
  children?: SceneNode[];
  datum?: unknown; // carried through for interaction
}
```

Three properties matter:

- **Keys are identity.** `bar-North` is the same mark from frame to frame regardless of where it
  sits in the array.
- **Nodes are inert.** No DOM handles, no callbacks. They can be built in a worker, asserted on
  in a test, or serialised.
- **`datum` rides along.** The renderer stores it on the element, so a hit test can recover the
  row that produced a mark without a parallel lookup structure.

Most component tests in this repo assert on the scene, not on the DOM. Testing that a bar chart
produces `bars-North` with the right height needs no browser at all.

## Diffing

`diffChildren(previous, next)` produces a patch list:

```ts
type Patch =
  | { op: 'create'; key: string; node: SceneNode; index: number }
  | { op: 'update'; key: string; node: SceneNode; previous: SceneNode }
  | { op: 'move'; key: string; node: SceneNode; index: number }
  | { op: 'remove'; key: string };
```

The algorithm:

1. Index the previous children by key.
2. Walk the next children. A key that is absent is a `create`; a key that is present and whose
   node differs is an `update`.
3. Track the highest previous index seen so far. A node whose previous index is _below_ that
   watermark has to move; a node at or above it is already in relative order and does not. This
   is the standard longest-increasing-subsequence shortcut, and it means reversing a list moves
   n−1 nodes rather than n, while appending moves none.
4. Anything left in the index is a `remove`.

`nodeUnchanged` short-circuits on referential identity first. A component that memoises its
scene gets a diff that is nothing but pointer comparisons.

## Patching

The SVG renderer keeps a `key → element` map and a shadow copy of the attributes it last wrote.
On `update` it compares attribute by attribute and calls `setAttribute` only where the value
actually differs; attributes that disappeared are removed. `null`, `undefined` and `false` mean
"not present". Text content is compared before assignment, because writing `textContent` is a
DOM mutation whether or not the string changed.

Every write is counted:

```ts
renderer.stats; // { frames, created, updated, removed, moved, attributeWrites, textWrites }
```

These counters are not decoration — they are how the renderer is tested. The suite asserts that
re-rendering an identical scene performs zero writes, and that changing one bar out of 500
performs exactly one attribute write. A performance property that is not asserted is a
performance property that regresses.

## Canvas

`createCanvasRenderer` implements the same `Renderer` interface against a 2D context. It is
immediate-mode — every frame redraws the whole scene — because Canvas has no retained objects
to diff. Group transforms are applied inside `save()` / `restore()` pairs.

The point is not that Canvas is faster here; at a few thousand marks it is not obviously so in
jsdom. The point is that the scene graph is backend-agnostic, so choosing a backend does not
mean rewriting components. Canvas becomes the right answer somewhere in the tens of thousands
of marks, where the DOM node count itself is the bottleneck.

Because the Canvas renderer takes a context rather than a canvas element, it can be tested with
a recording stub that captures every call — no `node-canvas`, no image comparison.

## What the numbers say

From `bench/RESULTS.md` (Node 24, Apple Silicon, jsdom):

| Operation                         | 1,000 marks | 5,000 marks |
| --------------------------------- | ----------- | ----------- |
| Re-render unchanged scene         | 0.13 ms     | 0.94 ms     |
| Re-render with one mark changed   | 0.15 ms     | 0.91 ms     |
| Full repaint (every mark changed) | 2.30 ms     | 13.24 ms    |

The honest reading: **the win is in the writes, not the walk.** Diffing 5,000 unchanged marks
still costs about 0.75 ms because the diff is O(n) — it visits every node either way. What the
architecture avoids is the ~12 ms of DOM mutation that a full repaint incurs. That is a ~14×
saving at 5,000 marks, and it is why "unchanged" and "one changed" cost the same: both are
dominated by the walk, and neither does meaningful DOM work.

If the O(n) walk itself became the bottleneck, the next step would be dirty-marking subtrees so
untouched groups are skipped entirely. That is listed as future work rather than claimed as
done.

**These are jsdom numbers.** jsdom implements the DOM API without layout, style resolution or
paint. Real browsers do far more work per mutation, so the absolute figures are optimistic. The
_ratio_ between full repaint and targeted patch is the transferable result, and if anything it
understates the benefit, since the browser work that a patch avoids is precisely the expensive
part.

## SVG versus Canvas

|                       | SVG                             | Canvas                            |
| --------------------- | ------------------------------- | --------------------------------- |
| Marks before it hurts | a few thousand                  | tens of thousands                 |
| Per-mark cost         | high (a DOM node each)          | low (a draw call each)            |
| Hit testing           | free (browser does it)          | manual (quadtree)                 |
| Accessibility         | real nodes, `aria-*`, focusable | none without a parallel structure |
| Text quality          | excellent                       | acceptable                        |
| Debugging             | inspect elements                | you cannot                        |
| Partial update        | yes, via diff                   | no, redraw the frame              |

d3-lite defaults to SVG because the charts it targets have hundreds of marks, and at that size
accessibility and debuggability are worth more than raw throughput. Canvas is there for when
that stops being true.
