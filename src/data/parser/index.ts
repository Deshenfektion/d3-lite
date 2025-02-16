import type { ParseResult, Row } from '../../types/data.ts';
import { isPlainObject } from '../../utils/guards.ts';
import { createDataset } from '../dataset.ts';
import { parseDelimited, type ParseDelimitedOptions } from './csv.ts';
import { parseJSON, type ParseJSONOptions } from './json.ts';

export type SourceFormat = 'csv' | 'tsv' | 'json' | 'rows';

export interface ParseOptions extends ParseDelimitedOptions, ParseJSONOptions {
  format?: SourceFormat;
}

export function detectFormat(input: unknown): SourceFormat {
  if (Array.isArray(input) || isPlainObject(input)) {
    if (Array.isArray(input) && input.every((item) => isPlainObject(item))) return 'rows';
    return 'json';
  }
  if (typeof input !== 'string') return 'rows';

  const head = input.trimStart().slice(0, 1);
  if (head === '{' || head === '[') return 'json';

  const firstLine = input.slice(0, 4096).split('\n', 1)[0] ?? '';
  const tabs = firstLine.split('\t').length - 1;
  const commas = firstLine.split(',').length - 1;
  return tabs > commas ? 'tsv' : 'csv';
}

export function parse(input: string | unknown, options: ParseOptions = {}): ParseResult {
  const format = options.format ?? detectFormat(input);

  switch (format) {
    case 'csv':
      return parseDelimited(input as string, { delimiter: ',', ...options });
    case 'tsv':
      return parseDelimited(input as string, { delimiter: '\t', ...options });
    case 'json':
      return parseJSON(input, options);
    case 'rows': {
      const rows = (Array.isArray(input) ? input : []) as Row[];
      return {
        dataset: createDataset(rows, {
          ...(options.source === undefined ? {} : { source: options.source }),
        }),
        issues: [],
      };
    }
  }
}

export function parseAll(
  sources: readonly { name: string; input: string | unknown; options?: ParseOptions }[]
): Map<string, ParseResult> {
  const out = new Map<string, ParseResult>();
  for (const entry of sources) {
    out.set(entry.name, parse(entry.input, { source: entry.name, ...entry.options }));
  }
  return out;
}

export * from './coerce.ts';
export * from './delimited.ts';
export * from './csv.ts';
export * from './json.ts';
