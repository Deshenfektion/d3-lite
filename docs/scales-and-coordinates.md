# Scales and coordinates

## What a scale is

A scale is a function from a data domain to a visual range, packaged with the metadata needed
to reverse it and to label it.

```ts
const y = scaleLinear({ domain: [0, 250], range: [400, 0] });
y(125); // 200
y.invert(200); // 125
y.ticks(5); // [0, 50, 100, 150, 200, 250]
```

Note the inverted range. Screen y grows downward, data y grows upward, so the range is written
back to front. This is the single most common source of upside-down charts, and putting it in
the scale means no component ever writes `height - value` by hand.

## The continuous core

Every continuous scale — linear, log, power, sqrt, time — is the same machine with a different
transform pair:

```
value ──transform.forward──► t ──normalize──► u ∈ [0,1] ──interpolate──► range value
```

| Scale  | forward              | inverse  |
| ------ | -------------------- | -------- | --- | ---------- | --- | ------- |
| linear | `x`                  | `x`      |
| log    | `log(x) / log(base)` | `base^x` |
| pow    | `sign(x) ·           | x        | ^k` | `sign(x) · | x   | ^(1/k)` |
| time   | `x` (epoch ms)       | `x`      |

`createContinuousScale` composes three steps: apply the transform to the input, normalise
against the transformed domain, then interpolate into the range. The transform is applied to
the _input value_, not just to the domain endpoints — getting that wrong makes a log scale
behave linearly, which is exactly the bug the scale tests caught during development.

### Two-point and multi-point domains

With a two-element domain the scale uses `bimap`: one normalise, one interpolate. With more
elements it switches to `polymap`, which sorts the segments, binary-searches the input into a
segment with `bisectRight`, then normalises and interpolates within it. That is what makes a
diverging scale like `domain: [-100, 0, 100], range: ['#184f95', '#f0efec', '#e34948']` work.

### Clamping

Off by default, so out-of-domain values extrapolate. Turn it on when the range is a pixel
extent you must not draw outside of. Clamping applies to `invert` too, so a pointer dragged
past the plot edge still yields a value inside the domain.

### Degenerate domains

`domain: [5, 5]` has zero width. Rather than dividing by zero and producing `NaN`, the
normaliser returns `0.5` — a constant column renders as a bar at mid-height instead of
disappearing. Every scale is tested for this case.

## Tick generation

Ticks come from the `1 / 2 / 5 × 10ⁿ` family, chosen so the interval is as close as possible to
`(stop - start) / count` while still being a round number. `tickIncrement` returns a negative
value to signal a sub-unit step, and the tick loop then divides instead of multiplying:

```ts
// step of 0.2 — computed as (i0 + i) / 5, not i * 0.2
ticks(0, 1, 5); // [0, 0.2, 0.4, 0.6, 0.8, 1]
```

Multiplying accumulates float error and produces `0.6000000000000001`. Dividing by an integer
divisor does not. It is a small thing that shows up directly in axis labels.

`nice()` expands the domain outward to tick boundaries. It must round _outward_ in both the
multiply and divide branches — rounding inward silently crops the top of your data, which was a
real bug here caught by a test asserting `niceDomain(0.3, 9.4, 10) === [0, 10]`.

Log scales override tick generation: when the domain spans few decades they emit minor ticks
(1, 2, 3 … 10, 20, 30 …); when it spans many they emit every *n*th power. `nice()` snaps to
powers of the base.

Time scales pick an interval from `second → minute → hour → day → month → year` based on the
span, then walk the calendar using real date arithmetic so month boundaries land on the 1st
rather than 30-day approximations.

## Discrete scales

**Ordinal** maps keys to range values by position, extending its domain when it meets an unseen
key (or returning an `unknown` value if configured). Colour assignment uses this, which is why
hiding a series never repaints the survivors: the key→index mapping is stable.

**Band** divides a pixel range into equal slots for categorical bars:

```
step      = span / (n - paddingInner + 2 · paddingOuter)
bandwidth = step · (1 - paddingInner)
offset    = start + (span - step · (n - paddingInner)) · align
```

`round: true` floors the step and rounds positions to whole pixels, which removes the blurry
half-pixel edges you get on non-retina displays. **Point** is band with `paddingInner = 1`, so
bandwidth collapses to zero and you get positions rather than slots.

**Quantize** cuts a continuous domain into equal buckets; **threshold** cuts it at explicit
boundaries. Both expose `invertExtent`, which a legend needs to label "50–75" next to a swatch.

## Colour scales

Colour interpolation happens in CIE Lab by default rather than sRGB. Interpolating
`#000000 → #ffffff` in sRGB gives `#808080` at the midpoint; in Lab it gives roughly `#777777`,
because L\* = 50 is the _perceptual_ middle grey and sRGB 128 is not. For sequential ramps this
is the difference between a scale whose steps look evenly spaced and one that bunches up in the
highlights.

`interpolateHcl` additionally takes the short way around the hue circle, so red → yellow passes
through orange rather than through cyan.

The bundled palette is validated, not chosen by eye: eight categorical hues in a fixed order
that clear a lightness band, a chroma floor, adjacent-pair colour-vision-deficiency separation
(worst ΔE 9.1 light / 8.4 dark, target ≥ 8) and a normal-vision floor (worst ΔE 19.6 / 19.3,
floor ≥ 15), in both light and dark modes.

Two consequences are baked into the components:

- **Categorical colours are never cycled.** `categoricalSlots(n)` caps at 8 and
  `exceedsCategoricalCapacity` tells you when to fold into "Other" instead.
- **All-pairs forms cap at 3.** In a scatter plot every pair of series can appear adjacent, and
  the full eight cannot clear the floors under that stricter test. `scatterPlot` therefore
  limits itself to the first three slots.

Three light-mode slots sit below 3:1 contrast against the light surface. The palette's relief
rule applies: ship visible labels or a table view. The sales dashboard example includes the
table for exactly this reason.

## Coordinate space

`createCartesianSpace` turns an outer box and margins into the geometry every component needs:

```
outer   the full svg box
margin  top / right / bottom / left
inner   { width, height } — the drawable region
plot    { x, y } — the translate applied to the plot group
```

Components draw in plot-local coordinates starting at `(0, 0)`; a single group transform moves
everything into place. That keeps mark maths free of margin arithmetic, and it means a pointer
position converts to plot space by subtracting `plot.x` / `plot.y` once.

`estimateLeftMargin` sizes the left gutter from the widest tick label so long labels are not
clipped.

## Zoom transforms

A zoom transform is `{ k, x, y }` applying `screen = data · k + translate`. The maths lives in
`src/coords/transform.ts`; `src/interaction/zoom.ts` only turns wheel and drag events into
transforms. `scaleAbout` keeps the point under the cursor stationary while scaling — the
property that makes zooming feel correct — and `rescaleX` / `rescaleY` produce a new scale with
a zoomed domain, so axes and ticks follow the zoom without any special-casing.
