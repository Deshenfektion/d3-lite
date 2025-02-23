import { describe, expect, it } from 'vitest';
import { createDataset, columnOf, numericColumn } from '@/data/dataset.ts';
import {
  derive,
  drop,
  dropMissing,
  fillMissing,
  filter,
  limit,
  normalizeField,
  rename,
  select,
  sortBy,
} from '@/data/transform/basics.ts';
import { countBy, groupBy, summarize } from '@/data/transform/aggregate.ts';
import { bin, computeBins } from '@/data/transform/bin.ts';
import { concat, join } from '@/data/transform/join.ts';
import { fold, pivot, unnest } from '@/data/transform/reshape.ts';
import { from, pipeline } from '@/data/transform/pipeline.ts';

const sales = createDataset([
  { region: 'North', quarter: 'Q1', revenue: 100, units: 10 },
  { region: 'North', quarter: 'Q2', revenue: 150, units: 12 },
  { region: 'South', quarter: 'Q1', revenue: 80, units: 8 },
  { region: 'South', quarter: 'Q2', revenue: 120, units: null },
]);

describe('dataset', () => {
  it('infers a schema on construction', () => {
    expect(sales.schema.rowCount).toBe(4);
    expect(sales.schema.fields.map((f) => f.name)).toEqual([
      'region',
      'quarter',
      'revenue',
      'units',
    ]);
    expect(sales.schema.fields[3]!.nullable).toBe(true);
  });

  it('caches extracted columns by identity', () => {
    expect(columnOf(sales, 'revenue')).toBe(columnOf(sales, 'revenue'));
    expect(columnOf(sales, 'revenue')).toEqual([100, 150, 80, 120]);
  });

  it('produces typed arrays for numeric access', () => {
    const values = numericColumn(sales, 'revenue');
    expect(values).toBeInstanceOf(Float64Array);
    expect([...values]).toEqual([100, 150, 80, 120]);
    expect(numericColumn(sales, 'revenue')).toBe(values);
  });

  it('maps missing values to NaN in numeric columns', () => {
    expect(Number.isNaN(numericColumn(sales, 'units')[3]!)).toBe(true);
  });
});

describe('row transforms', () => {
  it('filters rows', () => {
    const result = filter((row) => row.region === 'North')(sales);
    expect(result.rows).toHaveLength(2);
  });

  it('derives new fields without mutating the source', () => {
    const result = derive({ perUnit: (row) => Number(row.revenue) / 10 })(sales);
    expect(result.rows[0]!.perUnit).toBe(10);
    expect(sales.rows[0]).not.toHaveProperty('perUnit');
  });

  it('selects and drops fields', () => {
    expect(Object.keys(select(['region', 'revenue'])(sales).rows[0]!)).toEqual([
      'region',
      'revenue',
    ]);
    expect(Object.keys(drop(['units'])(sales).rows[0]!)).toEqual([
      'region',
      'quarter',
      'revenue',
    ]);
  });

  it('renames fields and preserves order', () => {
    const result = rename({ revenue: 'sales' })(sales);
    expect(result.schema.fields.map((f) => f.name)).toEqual([
      'region',
      'quarter',
      'sales',
      'units',
    ]);
  });

  it('sorts by multiple keys and directions', () => {
    const result = sortBy([{ field: 'revenue', direction: 'desc' }])(sales);
    expect(result.rows.map((row) => row.revenue)).toEqual([150, 120, 100, 80]);
  });

  it('sorts nulls last', () => {
    const result = sortBy(['units'])(sales);
    expect(result.rows.at(-1)!.units).toBeNull();
  });

  it('limits with an offset', () => {
    expect(limit(2, 1)(sales).rows.map((r) => r.revenue)).toEqual([150, 80]);
  });

  it('drops and fills missing values', () => {
    expect(dropMissing(['units'])(sales).rows).toHaveLength(3);
    expect(fillMissing({ units: 0 })(sales).rows[3]!.units).toBe(0);
  });

  it('normalizes a field into unit space', () => {
    const result = normalizeField('revenue', 'norm')(sales);
    expect(result.rows.map((r) => r.norm)).toEqual([20 / 70, 1, 0, 40 / 70]);
  });
});

describe('aggregation', () => {
  it('groups and aggregates', () => {
    const result = groupBy(
      ['region'],
      [
        { as: 'total', op: 'sum', field: 'revenue' },
        { as: 'avg', op: 'mean', field: 'revenue' },
        { as: 'n', op: 'count' },
      ]
    )(sales);

    expect(result.rows).toEqual([
      { region: 'North', total: 250, avg: 125, n: 2 },
      { region: 'South', total: 200, avg: 100, n: 2 },
    ]);
  });

  it('supports min, max, median, first, last and distinct', () => {
    const result = summarize([
      { as: 'lo', op: 'min', field: 'revenue' },
      { as: 'hi', op: 'max', field: 'revenue' },
      { as: 'mid', op: 'median', field: 'revenue' },
      { as: 'head', op: 'first', field: 'region' },
      { as: 'tail', op: 'last', field: 'region' },
      { as: 'regions', op: 'distinct', field: 'region' },
    ])(sales);

    expect(result.rows[0]).toEqual({
      lo: 80,
      hi: 150,
      mid: 110,
      head: 'North',
      tail: 'South',
      regions: 2,
    });
  });

  it('ignores nulls when aggregating', () => {
    const result = summarize([{ as: 'units', op: 'sum', field: 'units' }])(sales);
    expect(result.rows[0]!.units).toBe(30);
  });

  it('returns null when a group has no numeric values', () => {
    const empty = createDataset([{ a: null }]);
    expect(summarize([{ as: 'total', op: 'sum', field: 'a' }])(empty).rows[0]!.total).toBeNull();
  });

  it('counts by key', () => {
    expect(countBy('region')(sales).rows).toEqual([
      { region: 'North', count: 2 },
      { region: 'South', count: 2 },
    ]);
  });
});

describe('binning', () => {
  it('produces contiguous bins covering the domain', () => {
    const bins = computeBins([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { field: 'v', count: 5 });
    expect(bins.length).toBeGreaterThan(0);
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i]!.start).toBeCloseTo(bins[i - 1]!.end, 10);
    }
    expect(bins.reduce((total, entry) => total + entry.count, 0)).toBe(10);
  });

  it('places the maximum value in the last bin', () => {
    const bins = computeBins([0, 10], { field: 'v', count: 2, domain: [0, 10], nice: false });
    expect(bins.at(-1)!.count).toBeGreaterThan(0);
  });

  it('handles a constant column', () => {
    const bins = computeBins([5, 5, 5], { field: 'v' });
    expect(bins).toHaveLength(1);
    expect(bins[0]!.count).toBe(3);
  });

  it('returns no bins for empty input', () => {
    expect(computeBins([], { field: 'v' })).toEqual([]);
  });

  it('works as a dataset transform', () => {
    const data = createDataset([{ v: 1 }, { v: 2 }, { v: 9 }]);
    const result = bin({ field: 'v', count: 3 })(data);
    expect(result.schema.fields.map((f) => f.name)).toEqual(['bin_start', 'bin_end', 'count']);
  });
});

describe('joins', () => {
  const targets = createDataset([
    { region: 'North', target: 200 },
    { region: 'West', target: 90 },
  ]);

  it('performs an inner join', () => {
    const result = join(targets, { on: 'region' })(sales);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.target).toBe(200);
  });

  it('performs a left join filling absent matches with null', () => {
    const result = join(targets, { on: 'region', kind: 'left' })(sales);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[2]!.target).toBeNull();
  });

  it('prefixes joined fields when asked', () => {
    const result = join(targets, { on: 'region', prefix: 'plan_' })(sales);
    expect(result.rows[0]).toHaveProperty('plan_target');
  });

  it('concatenates datasets', () => {
    expect(concat([targets])(sales).rows).toHaveLength(6);
  });
});

describe('reshaping', () => {
  const wide = createDataset([{ region: 'North', q1: 10, q2: 20 }]);

  it('folds wide columns into long form', () => {
    const result = fold({ fields: ['q1', 'q2'] })(wide);
    expect(result.rows).toEqual([
      { region: 'North', key: 'q1', value: 10 },
      { region: 'North', key: 'q2', value: 20 },
    ]);
  });

  it('pivots long form back to wide', () => {
    const long = createDataset([
      { region: 'North', key: 'q1', value: 10 },
      { region: 'North', key: 'q2', value: 20 },
    ]);
    const result = pivot({ key: 'key', value: 'value', groupBy: ['region'] })(long);
    expect(result.rows[0]).toEqual({ region: 'North', q1: 10, q2: 20 });
  });

  it('unnests array valued fields', () => {
    const nested = createDataset([{ id: 1, tags: ['a', 'b'] as never }]);
    expect(unnest('tags')(nested).rows).toHaveLength(2);
  });
});

describe('pipeline', () => {
  it('composes transforms left to right', () => {
    const run = pipeline(
      filter((row) => Number(row.revenue) > 90),
      groupBy(['region'], [{ as: 'total', op: 'sum', field: 'revenue' }]),
      sortBy([{ field: 'total', direction: 'desc' }])
    );
    expect(run(sales).rows).toEqual([
      { region: 'North', total: 250 },
      { region: 'South', total: 120 },
    ]);
  });

  it('is an identity transform when empty', () => {
    expect(pipeline()(sales)).toBe(sales);
  });

  it('exposes a chainable wrapper', () => {
    const rows = from(sales)
      .apply(filter((row) => row.region === 'South'))
      .apply(select(['revenue']))
      .toRows();
    expect(rows).toEqual([{ revenue: 80 }, { revenue: 120 }]);
  });

  it('supports tapping mid-pipeline', () => {
    let seen = 0;
    from(sales)
      .tap((dataset) => {
        seen = dataset.rows.length;
      })
      .toDataset();
    expect(seen).toBe(4);
  });
});
