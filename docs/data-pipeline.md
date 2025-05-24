# The data pipeline

## The common internal representation

Everything becomes a `Dataset`:

```ts
interface Dataset {
  rows: readonly Row[]; // Record<string, Primitive>
  schema: Schema; // field names, types, nullability, missing counts
  source?: string; // provenance, useful when several sources are merged
}
```

Row-oriented, not columnar. This is a deliberate trade-off:

- **For:** transforms read naturally (`row.revenue`), heterogeneous rows are trivial, and
  accessor functions are the same shape users already know from D3.
- **Against:** column scans touch one object per row instead of one contiguous buffer.

The mitigation is a lazy column cache. `columnOf(dataset, field)` extracts a field into a flat
array once and memoises it in a `WeakMap` keyed by dataset identity; `numericColumn` does the
same into a `Float64Array`. Because datasets are treated as immutable, the cache never goes
stale, and because the map is weak, it dies with the dataset.

## Parsing

### Delimited input

`tokenizeDelimited` is a character-code state machine over the raw string. It handles the parts
of RFC 4180 that show up in real exports:

- quoted fields containing the delimiter
- doubled quotes as an escape (`""` → `"`)
- newlines inside quoted fields
- `\r\n`, `\n` and bare `\r` line endings
- a leading byte order mark
- optional comment lines
- `maxRows` for previewing a large file

Delimiter detection counts candidate delimiters (`,`, `;`, tab, `|`) on the first line while
tracking quote state, so a header like `"a,b,c";x` is correctly read as semicolon-delimited.

### Type inference

Inference runs per column over a sample (200 rows by default) and widens as it goes:

```
null  →  boolean  →  number  →  date  →  string
```

`unifyTypes` merges two observations. `null` is absorbed by anything. A column of numbers that
later shows a date becomes `string`, because there is no lossless common type. A column that is
entirely missing becomes `string` rather than staying `null`.

Only unambiguous date formats are recognised — ISO 8601 and `YYYY/MM/DD`. `03/04/2025` is left
as a string on purpose: guessing between American and European ordering silently corrupts data,
and a wrong date is worse than an unparsed one. Pass `types: { when: 'date' }` to override.

Missing values are token-driven: `''`, `NA`, `N/A`, `null`, `nil`, `NaN`, `-`, `--`,
case-insensitive. The set is configurable.

### Nested JSON

`flattenObject` walks an object into dotted paths (`{a: {b: 1}}` → `{'a.b': 1}`). Arrays are
handled by policy: `index` (default) produces `tags.0`, `tags.1`; `join` produces a single
comma-joined string; `drop` discards them. Beyond `maxDepth` the remaining subtree is stored as
a JSON string rather than exploding into hundreds of columns.

`path` selects the records: `parseJSON(text, { path: 'result.items' })`.

### Errors are data

Parsers return `{ dataset, issues }`. An issue is `ragged-row`, `unparsable-value`,
`duplicate-field` or `empty-input`, with a row index and field name where relevant. Ragged rows
are padded with `null` and reported rather than dropped. Duplicate headers are renamed (`a`,
`a_2`) and reported.

## Validation

Schema inference describes what the data _is_. Validation asserts what it _should be_:

```ts
const result = validateDataset(sales, [
  { name: 'region', type: 'string', nullable: false },
  { name: 'revenue', type: 'number', min: 0 },
  { name: 'grade', oneOf: ['A', 'B', 'C'] },
]);
```

Problems carry a severity. Type mismatches, unexpected nulls and out-of-range numbers are
errors; values outside an allowed set are warnings. `assertValid` throws instead, for pipelines
that would rather fail loudly.

## Transformation

A transform is just `(dataset: Dataset) => Dataset`. That single signature is what makes them
composable:

```ts
const summary = pipeline(
  filter((row) => Number(row.revenue) > 100),
  groupBy(['region'], [{ as: 'total', op: 'sum', field: 'revenue' }]),
  sortBy([{ field: 'total', direction: 'desc' }])
)(sales);
```

Available operators:

| Group        | Operators                                      |
| ------------ | ---------------------------------------------- |
| Rows         | `filter`, `map`, `derive`, `limit`, `sortBy`   |
| Columns      | `select`, `drop`, `rename`                     |
| Missing data | `dropMissing`, `fillMissing`, `normalizeField` |
| Aggregation  | `groupBy`, `summarize`, `countBy`              |
| Distribution | `bin`, `computeBins`                           |
| Combining    | `join` (inner/left), `concat`                  |
| Reshaping    | `fold`, `pivot`, `unnest`                      |

Aggregations available to `groupBy`: `count`, `sum`, `mean`, `median`, `min`, `max`, `first`,
`last`, `distinct`, `stddev`, `p90`.

`Pipe.from(dataset).apply(...).toRows()` is a chainable wrapper over the same functions, for
when method syntax reads better.

### Performance notes

- Transforms never mutate their input. `filter` and `sortBy` reuse row objects rather than
  cloning them, so the copy is one pointer per row, not one object per row.
- `groupBy` builds one string signature per row and uses a single `Map`. Signatures are
  concatenated with a space separator, which is why key values are normalised through
  `toStringKey` first.
- `sortBy` uses one comparator closure over the key list rather than a chain of sorts.
- `variance` and `deviation` use Welford's online algorithm — one pass, no intermediate array,
  and numerically stable for large values.
- Binning uses the same `tickStep` logic as the axes, so histogram boundaries land on round
  numbers instead of arbitrary fractions.

Measured on this machine: parsing 20,000 CSV rows with full type inference takes about 21 ms;
grouping and sorting those rows takes about 3.9 ms; aggregating 50,000 rows into 5 groups takes
about 4.3 ms. See `bench/RESULTS.md`.
