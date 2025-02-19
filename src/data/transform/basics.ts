import type { Dataset, Primitive, Row } from '../../types/data.ts';
import { toNumber, toStringKey } from '../../utils/guards.ts';
import { createDataset } from '../dataset.ts';
import type { RowMapper, RowPredicate, Transform, ValueAccessor } from './types.ts';

export function filter(predicate: RowPredicate): Transform {
  return (dataset) => {
    const rows: Row[] = [];
    for (let i = 0; i < dataset.rows.length; i++) {
      const row = dataset.rows[i];
      if (row !== undefined && predicate(row, i)) rows.push(row);
    }
    return createDataset(rows, {
      schema: { fields: dataset.schema.fields, rowCount: rows.length },
    });
  };
}

export function map(mapper: RowMapper): Transform {
  return (dataset) => {
    const rows = dataset.rows.map((row, index) => mapper(row, index));
    return createDataset(rows);
  };
}

export function derive(fields: Record<string, ValueAccessor>): Transform {
  const entries = Object.entries(fields);
  return (dataset) => {
    const rows = dataset.rows.map((row, index) => {
      const next: Row = { ...row };
      for (const [name, accessor] of entries) next[name] = accessor(row, index);
      return next;
    });
    return createDataset(rows);
  };
}

export function select(names: readonly string[]): Transform {
  return (dataset) => {
    const rows = dataset.rows.map((row) => {
      const next: Row = {};
      for (const name of names) next[name] = row[name] ?? null;
      return next;
    });
    return createDataset(rows, { fieldOrder: names });
  };
}

export function drop(names: readonly string[]): Transform {
  const removed = new Set(names);
  return (dataset) => {
    const kept = dataset.schema.fields
      .map((field) => field.name)
      .filter((name) => !removed.has(name));
    return select(kept)(dataset);
  };
}

export function rename(mapping: Readonly<Record<string, string>>): Transform {
  return (dataset) => {
    const rows = dataset.rows.map((row) => {
      const next: Row = {};
      for (const key of Object.keys(row)) next[mapping[key] ?? key] = row[key] ?? null;
      return next;
    });
    const order = dataset.schema.fields.map((field) => mapping[field.name] ?? field.name);
    return createDataset(rows, { fieldOrder: order });
  };
}

export type SortDirection = 'asc' | 'desc';

export interface SortKey {
  readonly field: string;
  readonly direction?: SortDirection;
}

function comparePrimitives(a: Primitive, b: Primitive): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' || typeof b === 'number' || a instanceof Date || b instanceof Date) {
    const na = toNumber(a);
    const nb = toNumber(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = toStringKey(a);
  const sb = toStringKey(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function sortBy(keys: readonly (SortKey | string)[]): Transform {
  const normalized: SortKey[] = keys.map((key) =>
    typeof key === 'string' ? { field: key, direction: 'asc' } : key
  );
  return (dataset) => {
    const rows = [...dataset.rows].sort((a, b) => {
      for (const key of normalized) {
        const order = comparePrimitives(a[key.field] ?? null, b[key.field] ?? null);
        if (order !== 0) return key.direction === 'desc' ? -order : order;
      }
      return 0;
    });
    return createDataset(rows, { schema: dataset.schema });
  };
}

export function limit(count: number, offset = 0): Transform {
  return (dataset) => {
    const rows = dataset.rows.slice(offset, offset + count);
    return createDataset(rows, {
      schema: { fields: dataset.schema.fields, rowCount: rows.length },
    });
  };
}

export function dropMissing(names?: readonly string[]): Transform {
  return (dataset) => {
    const fields = names ?? dataset.schema.fields.map((field) => field.name);
    return filter((row) => fields.every((name) => (row[name] ?? null) !== null))(dataset);
  };
}

export function fillMissing(values: Readonly<Record<string, Primitive>>): Transform {
  const entries = Object.entries(values);
  return (dataset) => {
    const rows = dataset.rows.map((row) => {
      let next: Row | undefined;
      for (const [name, fallback] of entries) {
        if ((row[name] ?? null) === null) {
          next ??= { ...row };
          next[name] = fallback;
        }
      }
      return next ?? row;
    });
    return createDataset(rows, { fieldOrder: dataset.schema.fields.map((f) => f.name) });
  };
}

export function normalizeField(field: string, target = field): Transform {
  return (dataset: Dataset) => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const row of dataset.rows) {
      const value = toNumber(row[field] ?? null);
      if (Number.isNaN(value)) continue;
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
    const span = hi - lo;
    return derive({
      [target]: (row) => {
        const value = toNumber(row[field] ?? null);
        if (Number.isNaN(value)) return null;
        return span === 0 ? 0 : (value - lo) / span;
      },
    })(dataset);
  };
}
