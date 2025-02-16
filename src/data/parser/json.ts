import type { ParseIssue, ParseResult, Primitive, Row } from '../../types/data.ts';
import { isPlainObject, isPrimitive } from '../../utils/guards.ts';
import { createDataset } from '../dataset.ts';

export interface FlattenOptions {
  separator?: string;
  maxDepth?: number;
  arrays?: 'index' | 'join' | 'drop';
}

export interface ParseJSONOptions extends FlattenOptions {
  path?: string;
  source?: string;
}

function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (segment === '') continue;
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function flattenObject(
  input: Record<string, unknown>,
  options: FlattenOptions = {}
): Row {
  const separator = options.separator ?? '.';
  const maxDepth = options.maxDepth ?? 8;
  const arrays = options.arrays ?? 'index';
  const out: Row = {};

  const walk = (value: unknown, prefix: string, depth: number): void => {
    if (isPrimitive(value)) {
      out[prefix] = value;
      return;
    }
    if (value === undefined) {
      out[prefix] = null;
      return;
    }
    if (Array.isArray(value)) {
      if (arrays === 'drop') return;
      if (arrays === 'join') {
        out[prefix] = value.map((item) => (isPrimitive(item) ? String(item) : '')).join(', ');
        return;
      }
      if (depth >= maxDepth) {
        out[prefix] = JSON.stringify(value);
        return;
      }
      value.forEach((item, index) => {
        walk(item, `${prefix}${separator}${index}`, depth + 1);
      });
      return;
    }
    if (isPlainObject(value)) {
      if (depth >= maxDepth) {
        out[prefix] = JSON.stringify(value);
        return;
      }
      for (const key of Object.keys(value)) {
        const next = prefix === '' ? key : `${prefix}${separator}${key}`;
        walk(value[key], next, depth + 1);
      }
      return;
    }
    out[prefix] = null;
  };

  walk(input, '', 0);
  return out;
}

export function normalizeRecords(input: unknown, options: FlattenOptions = {}): Row[] {
  if (!Array.isArray(input)) return [];
  const rows: Row[] = [];
  for (const item of input) {
    if (isPlainObject(item)) rows.push(flattenObject(item, options));
    else if (isPrimitive(item)) rows.push({ value: item as Primitive });
  }
  return rows;
}

export function parseJSON(input: string | unknown, options: ParseJSONOptions = {}): ParseResult {
  const issues: ParseIssue[] = [];
  let payload: unknown = input;

  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input);
    } catch (error) {
      issues.push({
        kind: 'unparsable-value',
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      return { dataset: createDataset([]), issues };
    }
  }

  if (options.path) payload = readPath(payload, options.path);

  if (isPlainObject(payload)) payload = [payload];

  const rows = normalizeRecords(payload, options);
  if (rows.length === 0) {
    issues.push({ kind: 'empty-input', message: 'No records found in JSON input' });
  }

  const dataset = createDataset(rows, {
    ...(options.source === undefined ? {} : { source: options.source }),
  });
  return { dataset, issues };
}
