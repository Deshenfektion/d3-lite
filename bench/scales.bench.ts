import { bench, describe } from 'vitest';
import { scaleLinear } from '@/scales/linear.ts';
import { scaleLog } from '@/scales/log.ts';
import { scaleBand } from '@/scales/band.ts';
import { scaleSequentialColor } from '@/scales/color.ts';
import { parseCSV } from '@/data/parser/csv.ts';
import { groupBy } from '@/data/transform/aggregate.ts';
import { createDataset } from '@/data/dataset.ts';
import { seededRandom } from './harness.ts';

const random = seededRandom(99);
const categories = ['North', 'South', 'East', 'West', 'Central'];

describe('scale projection', () => {
  const linear = scaleLinear({ domain: [0, 1000], range: [0, 720] });
  const log = scaleLog({ domain: [1, 1000], range: [0, 720] });
  const band = scaleBand({ domain: categories, range: [0, 720], padding: 0.2 });
  const color = scaleSequentialColor({ domain: [0, 100] });

  bench('linear x10k', () => {
    for (let i = 0; i < 10000; i++) linear(i % 1000);
  });

  bench('log x10k', () => {
    for (let i = 0; i < 10000; i++) log((i % 999) + 1);
  });

  bench('band x10k', () => {
    for (let i = 0; i < 10000; i++) band(categories[i % categories.length] as string);
  });

  bench('sequential color x10k', () => {
    for (let i = 0; i < 10000; i++) color(i % 100);
  });
});

describe('data pipeline', () => {
  const rows = ['a,b,c'];
  for (let i = 0; i < 5000; i++) {
    rows.push(`${categories[i % categories.length]},${(random() * 100).toFixed(2)},${i}`);
  }
  const csv = rows.join('\n');
  const dataset = createDataset(
    Array.from({ length: 20000 }, (_, i) => ({
      category: categories[i % categories.length] as string,
      value: random() * 100,
    }))
  );

  bench('parse 5k row csv', () => {
    parseCSV(csv);
  });

  bench('groupBy 20k rows', () => {
    groupBy(['category'], [{ as: 'total', op: 'sum', field: 'value' }])(dataset);
  });
});
