# Component architecture

## Three layers

**Scene builders** are pure functions returning a `SceneNode`. `axis`, `grid`, `legend`,
`barMarks`, `lineMark`, `pointMarks` are all of this kind. They take resolved scales and a
theme, and they have no lifecycle, no state and no DOM access. They are trivially testable.

**The chart shell** (`createChart`) owns the parts that are the same for every chart: the
coordinate space, the renderer, the store, the reactive effect, resize, theming and teardown.

**Chart types** (`barChart`, `lineChart`, `scatterPlot`, `histogram`) are thin. Each one
declares its options, computes its scales from the data, and composes scene builders into
layers. The bar chart is roughly 230 lines and most of that is option handling.

```
barChart(container, options)
   │
   ├── resolves scales from data ──► scaleBand, scaleLinear
   ├── composes layers ───────────► grid, marks, axes, legend
   │
   └── createChart
          ├── CartesianSpace
          ├── Store<BarChartState>
          ├── effect: state → layers → SceneNode
          └── SvgRenderer: diff + patch
```

## Adding a chart type

The whole contract is a function from state and context to a list of scene nodes:

```ts
export function boxPlot(container: Element, options: BoxPlotOptions) {
  const build = (state: BoxPlotState, context: ChartContext): SceneNode[] => {
    const { space, theme } = context;
    const band = scaleBand({ domain: categories, range: [0, space.inner.width], padding: 0.3 });
    const value = scaleLinear({ domain: extent, range: [space.inner.height, 0] }).nice(5);

    return [
      grid('grid', {
        scale: value,
        theme,
        orientation: 'horizontal',
        length: space.inner.width,
      }),
      whiskerMarks('whiskers', {
        /* ... */
      }),
      boxMarks('boxes', {
        /* ... */
      }),
      axis('axis-x', { scale: band, orientation: 'bottom', theme, length: space.inner.width }),
      axis('axis-y', { scale: value, orientation: 'left', theme, length: space.inner.height }),
    ];
  };

  return createChart(container, {
    initialState: { dataset: toDataset(options.data), highlight: null },
    layers: [(state, context) => group({ key: 'box-plot' }, build(state, context))],
  });
}
```

No renderer code, no event wiring, no diffing. Axes, grid, legend, theming, resize, reactive
updates and teardown come from the shell.

## Encoding channels

`src/encode` is the reusable data-to-visual mapping. A channel is a field, a constant, or an
accessor, optionally passed through a scale:

```ts
const encoding = resolveEncoding({
  x: { field: 'month', scale: xScale, as: 'number' },
  y: { field: 'revenue', scale: yScale, as: 'number' },
  color: { field: 'region', scale: colorScale, as: 'string' },
  size: { value: 6 },
  key: { field: 'id', as: 'string' },
});

const marks = encodeRows(dataset.rows, encoding);
// [{ key, x, y, color, size, opacity, shape, label, datum, index }, ...]
```

Every channel resolves to a function of `(row, index)`, so a constant, a raw field and a scaled
field are interchangeable at the call site. Resolution happens once per render rather than once
per row per channel.

## Built-in defaults

The components encode a set of chart-design rules so that the default output is already
defensible.

| Rule                                                               | Where it lives                                   |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| 4px rounded corners on the data end only, anchored to the baseline | `roundedRectPath` corner selection in `barMarks` |
| 2px surface gap between stacked segments                           | `applySegmentGap`                                |
| 2px stroke rings on point marks so overlaps stay legible           | `pointMarks`                                     |
| Minimum 8px marker diameter                                        | `MIN_MARKER_SIZE`                                |
| 2px line weight, round joins and caps                              | `lineMark`                                       |
| Legend appears automatically at ≥ 2 series, suppressed at 1        | `showLegend` default                             |
| Axis and grid use recessive muted/gridline tokens                  | `axis`, `grid`                                   |
| Labels use ink tokens, never the series colour                     | `axis`, `valueLabels`, `createTooltip`           |
| Tabular figures on value labels                                    | `valueLabels`                                    |
| Categorical colour by entity, never by rank                        | ordinal scale keyed on the series name           |
| Scatter caps at 3 categorical slots                                | `ALL_PAIRS_CATEGORICAL_LIMIT`                    |

The last two are worth expanding.

**Colour follows the entity.** Hiding a series must not repaint the others. Because colour comes
from an ordinal scale keyed on the series name — not from the index in the filtered array — the
survivors keep their hues. The line chart test asserts this directly.

**Scatter caps at three.** The palette's eight slots are validated for _adjacent_ pairs, which
is the right test for stacks, bars and lines. In a scatter plot any two series can end up side
by side, and under that stricter all-pairs test the full eight cannot clear the separation
floors. Three can, so that is the cap.

## Chart options

Shared across all chart types:

| Option                   | Meaning                                      |
| ------------------------ | -------------------------------------------- |
| `data`                   | a `Dataset` or a plain row array             |
| `width`, `height`        | outer dimensions in pixels                   |
| `margin`                 | partial overrides of the default margin      |
| `mode` / `theme`         | `'light'` / `'dark'`, or a full theme object |
| `xLabel`, `yLabel`       | axis titles                                  |
| `valueFormat`            | formatter for values and axis labels         |
| `showGrid`, `showLegend` | override the defaults                        |
| `ariaLabel`              | accessible name on the root SVG              |

Every chart returns the shell interface — `update`, `resize`, `setTheme`, `render`, `destroy`,
`scene`, `store`, `renderer`, `element` — plus its own verbs, such as `toggleSeries` and
`highlight` on the bar chart or `setBinCount` on the histogram.

## Testing components

Because layers are pure, most assertions run against the scene rather than the DOM:

```ts
const chart = barChart(host, { data: sales, x: 'region', y: 'revenue' });
expect(keysOf(chart.scene())).toContain('bars-North');

chart.highlight('North');
expect(findByKey(chart.scene()!, 'bars-South')!.attrs['fill-opacity']).toBeLessThan(1);
```

DOM assertions are reserved for what only the DOM can answer — that updating data reuses
elements rather than recreating them, and that `destroy` detaches cleanly.
