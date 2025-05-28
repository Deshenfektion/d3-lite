import type { FieldType, ParseIssue, ParseResult, Primitive, Row } from '../../types/data.ts';
import { createDataset } from '../dataset.ts';
import { inferSchema } from '../schema/infer.ts';
import {
  buildMissingSet,
  coerceValue,
  inferValueType,
  isMissing,
  unifyTypes,
  type CoerceOptions,
} from './coerce.ts';
import { tokenizeDelimited, type TokenizeOptions } from './delimited.ts';

export interface ParseDelimitedOptions extends TokenizeOptions, CoerceOptions {
  header?: boolean;
  typeSampleSize?: number;
  types?: Readonly<Record<string, FieldType>>;
  source?: string;
}

function dedupeHeader(raw: readonly string[], issues: ParseIssue[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((name, index) => {
    const base = name.trim() === '' ? `column_${index + 1}` : name.trim();
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return base;
    issues.push({
      kind: 'duplicate-field',
      message: `Duplicate field "${base}" renamed to "${base}_${count + 1}"`,
      field: base,
    });
    return `${base}_${count + 1}`;
  });
}

export function parseDelimited(text: string, options: ParseDelimitedOptions = {}): ParseResult {
  const issues: ParseIssue[] = [];
  const tokenizeOptions: TokenizeOptions = {};
  if (options.delimiter !== undefined) tokenizeOptions.delimiter = options.delimiter;
  if (options.skipEmptyLines !== undefined)
    tokenizeOptions.skipEmptyLines = options.skipEmptyLines;
  if (options.comment !== undefined) tokenizeOptions.comment = options.comment;
  if (options.maxRows !== undefined) tokenizeOptions.maxRows = options.maxRows;

  const table = tokenizeDelimited(text, tokenizeOptions);

  if (table.length === 0) {
    issues.push({ kind: 'empty-input', message: 'Input contained no parsable rows' });
    return { dataset: createDataset([]), issues };
  }

  const useHeader = options.header ?? true;
  const firstRow = table[0] ?? [];
  const header = useHeader
    ? dedupeHeader(firstRow, issues)
    : firstRow.map((_, index) => `column_${index + 1}`);
  const body = useHeader ? table.slice(1) : table;
  const width = header.length;

  const missingTokens = buildMissingSet(options.missingTokens);
  const coerceOptions: CoerceOptions = {};
  if (options.thousandsSeparator !== undefined)
    coerceOptions.thousandsSeparator = options.thousandsSeparator;
  if (options.parseDates !== undefined) coerceOptions.parseDates = options.parseDates;

  const sampleSize = Math.min(body.length, options.typeSampleSize ?? 200);
  const columnTypes: FieldType[] = new Array<FieldType>(width).fill('null');

  for (let c = 0; c < width; c++) {
    const name = header[c] as string;
    const forced = options.types?.[name];
    if (forced) {
      columnTypes[c] = forced;
      continue;
    }
    let resolved: FieldType = 'null';
    for (let r = 0; r < sampleSize; r++) {
      const raw = body[r]?.[c];
      if (raw === undefined || isMissing(raw, missingTokens)) continue;
      resolved = unifyTypes(resolved, inferValueType(raw, coerceOptions));
      if (resolved === 'string') break;
    }
    columnTypes[c] = resolved === 'null' ? 'string' : resolved;
  }

  const rows: Row[] = new Array<Row>(body.length);
  for (let r = 0; r < body.length; r++) {
    const cells = body[r] as string[];
    if (cells.length !== width) {
      issues.push({
        kind: 'ragged-row',
        message: `Row ${r + 1} has ${cells.length} cells, expected ${width}`,
        row: r,
      });
    }
    const row: Row = {};
    for (let c = 0; c < width; c++) {
      const name = header[c] as string;
      const raw = cells[c];
      if (raw === undefined || isMissing(raw, missingTokens)) {
        row[name] = null;
        continue;
      }
      const value: Primitive = coerceValue(raw, columnTypes[c] as FieldType, coerceOptions);
      if (value === null && columnTypes[c] !== 'string') {
        issues.push({
          kind: 'unparsable-value',
          message: `Could not read "${raw}" as ${columnTypes[c]}`,
          row: r,
          field: name,
        });
      }
      row[name] = value;
    }
    rows[r] = row;
  }

  const schema = inferSchema(rows, { fieldOrder: header });
  const dataset = createDataset(rows, {
    schema,
    ...(options.source === undefined ? {} : { source: options.source }),
  });
  return { dataset, issues };
}

export function parseCSV(text: string, options: ParseDelimitedOptions = {}): ParseResult {
  return parseDelimited(text, { delimiter: ',', ...options });
}

export function parseTSV(text: string, options: ParseDelimitedOptions = {}): ParseResult {
  return parseDelimited(text, { delimiter: '\t', ...options });
}
