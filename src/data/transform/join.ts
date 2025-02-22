import type { Dataset, Row } from '../../types/data.ts';
import { toStringKey } from '../../utils/guards.ts';
import { createDataset } from '../dataset.ts';
import type { Transform } from './types.ts';

export type JoinKind = 'inner' | 'left';

export interface JoinOptions {
  readonly on: string | readonly [string, string];
  readonly kind?: JoinKind;
  readonly prefix?: string;
}

function keyPair(on: JoinOptions['on']): [string, string] {
  return typeof on === 'string' ? [on, on] : [on[0], on[1]];
}

export function join(right: Dataset, options: JoinOptions): Transform {
  const [leftKey, rightKey] = keyPair(options.on);
  const kind = options.kind ?? 'inner';
  const prefix = options.prefix ?? '';

  const index = new Map<string, Row>();
  for (const row of right.rows) index.set(toStringKey(row[rightKey] ?? null), row);

  const rightFields = right.schema.fields
    .map((field) => field.name)
    .filter((name) => name !== rightKey);

  return (left) => {
    const rows: Row[] = [];
    for (const row of left.rows) {
      const match = index.get(toStringKey(row[leftKey] ?? null));
      if (!match) {
        if (kind === 'left') {
          const merged: Row = { ...row };
          for (const name of rightFields) merged[`${prefix}${name}`] = null;
          rows.push(merged);
        }
        continue;
      }
      const merged: Row = { ...row };
      for (const name of rightFields) merged[`${prefix}${name}`] = match[name] ?? null;
      rows.push(merged);
    }
    return createDataset(rows);
  };
}

export function concat(others: readonly Dataset[]): Transform {
  return (dataset) => {
    const rows: Row[] = [...dataset.rows];
    for (const other of others) rows.push(...other.rows);
    return createDataset(rows);
  };
}
