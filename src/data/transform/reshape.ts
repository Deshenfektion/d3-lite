import type { Primitive, Row } from '../../types/data.ts';
import { toStringKey } from '../../utils/guards.ts';
import { createDataset } from '../dataset.ts';
import type { Transform } from './types.ts';

export interface FoldOptions {
  readonly fields: readonly string[];
  readonly as?: { key?: string; value?: string };
  readonly keep?: readonly string[];
}

export function fold(options: FoldOptions): Transform {
  const keyName = options.as?.key ?? 'key';
  const valueName = options.as?.value ?? 'value';

  return (dataset) => {
    const keep =
      options.keep ??
      dataset.schema.fields
        .map((field) => field.name)
        .filter((name) => !options.fields.includes(name));

    const rows: Row[] = [];
    for (const row of dataset.rows) {
      for (const field of options.fields) {
        const next: Row = {};
        for (const name of keep) next[name] = row[name] ?? null;
        next[keyName] = field;
        next[valueName] = row[field] ?? null;
        rows.push(next);
      }
    }
    return createDataset(rows, { fieldOrder: [...keep, keyName, valueName] });
  };
}

export interface PivotOptions {
  readonly key: string;
  readonly value: string;
  readonly groupBy: readonly string[];
}

export function pivot(options: PivotOptions): Transform {
  return (dataset) => {
    const buckets = new Map<string, Row>();
    const columns = new Set<string>();

    for (const row of dataset.rows) {
      let signature = '';
      const base: Row = {};
      for (const name of options.groupBy) {
        const value = row[name] ?? null;
        base[name] = value;
        signature += `${toStringKey(value)} `;
      }
      let bucket = buckets.get(signature);
      if (!bucket) {
        bucket = base;
        buckets.set(signature, bucket);
      }
      const column = toStringKey(row[options.key] ?? null);
      columns.add(column);
      bucket[column] = (row[options.value] ?? null) as Primitive;
    }

    const columnList = [...columns];
    const rows = [...buckets.values()].map((row) => {
      const next: Row = { ...row };
      for (const column of columnList) next[column] ??= null;
      return next;
    });

    return createDataset(rows, { fieldOrder: [...options.groupBy, ...columnList] });
  };
}

export function unnest(field: string, as = field): Transform {
  return (dataset) => {
    const rows: Row[] = [];
    for (const row of dataset.rows) {
      const value: unknown = row[field];
      if (Array.isArray(value)) {
        for (const item of value as Primitive[]) rows.push({ ...row, [as]: item });
      } else {
        rows.push(row);
      }
    }
    return createDataset(rows);
  };
}
