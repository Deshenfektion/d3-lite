import type { Dataset, Primitive, Row, Schema } from '../types/data.ts';
import { toNumber } from '../utils/guards.ts';
import { inferSchema, type InferSchemaOptions } from './schema/infer.ts';

export interface CreateDatasetOptions extends InferSchemaOptions {
  source?: string;
  schema?: Schema;
}

export function createDataset(rows: readonly Row[], options: CreateDatasetOptions = {}): Dataset {
  const schema = options.schema ?? inferSchema(rows, options);
  const dataset: Dataset = options.source
    ? { rows, schema, source: options.source }
    : { rows, schema };
  return dataset;
}

export const emptyDataset: Dataset = createDataset([]);

const columnCache = new WeakMap<Dataset, Map<string, readonly Primitive[]>>();
const numericCache = new WeakMap<Dataset, Map<string, Float64Array>>();

export function columnOf(dataset: Dataset, field: string): readonly Primitive[] {
  let perDataset = columnCache.get(dataset);
  if (!perDataset) {
    perDataset = new Map();
    columnCache.set(dataset, perDataset);
  }
  const cached = perDataset.get(field);
  if (cached) return cached;

  const n = dataset.rows.length;
  const column = new Array<Primitive>(n);
  for (let i = 0; i < n; i++) {
    const row = dataset.rows[i];
    column[i] = row === undefined ? null : (row[field] ?? null);
  }
  perDataset.set(field, column);
  return column;
}

export function numericColumn(dataset: Dataset, field: string): Float64Array {
  let perDataset = numericCache.get(dataset);
  if (!perDataset) {
    perDataset = new Map();
    numericCache.set(dataset, perDataset);
  }
  const cached = perDataset.get(field);
  if (cached) return cached;

  const source = columnOf(dataset, field);
  const values = new Float64Array(source.length);
  for (let i = 0; i < source.length; i++) values[i] = toNumber(source[i] ?? null);
  perDataset.set(field, values);
  return values;
}

export function withRows(dataset: Dataset, rows: readonly Row[]): Dataset {
  return createDataset(rows, {
    fieldOrder: dataset.schema.fields.map((field) => field.name),
    ...(dataset.source === undefined ? {} : { source: dataset.source }),
  });
}

export function datasetSize(dataset: Dataset): number {
  return dataset.rows.length;
}
