import type { FieldType, Primitive } from '../../types/data.ts';

const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?)?$/;
const SLASH_DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;

const TRUE_TOKENS = new Set(['true', 'yes', 'y', 't']);
const FALSE_TOKENS = new Set(['false', 'no', 'n', 'f']);

export const DEFAULT_MISSING_TOKENS = ['', 'na', 'n/a', 'null', 'nil', 'nan', '-', '--'];

export interface CoerceOptions {
  missingTokens?: readonly string[];
  thousandsSeparator?: string;
  parseDates?: boolean;
}

export function isMissing(raw: string, missingTokens: ReadonlySet<string>): boolean {
  return missingTokens.has(raw.trim().toLowerCase());
}

export function buildMissingSet(
  tokens: readonly string[] = DEFAULT_MISSING_TOKENS
): Set<string> {
  return new Set(tokens.map((token) => token.toLowerCase()));
}

export function looksNumeric(raw: string, thousandsSeparator?: string): boolean {
  const candidate =
    thousandsSeparator && thousandsSeparator.length > 0
      ? raw.split(thousandsSeparator).join('')
      : raw;
  return NUMBER_PATTERN.test(candidate.trim());
}

export function looksTemporal(raw: string): boolean {
  const trimmed = raw.trim();
  if (!ISO_DATE_PATTERN.test(trimmed) && !SLASH_DATE_PATTERN.test(trimmed)) return false;
  return !Number.isNaN(new Date(trimmed.replace(' ', 'T')).getTime());
}

export function looksBoolean(raw: string): boolean {
  const token = raw.trim().toLowerCase();
  return TRUE_TOKENS.has(token) || FALSE_TOKENS.has(token);
}

export function inferValueType(raw: string, options: CoerceOptions = {}): FieldType {
  if (looksNumeric(raw, options.thousandsSeparator)) return 'number';
  if (options.parseDates !== false && looksTemporal(raw)) return 'date';
  if (looksBoolean(raw)) return 'boolean';
  return 'string';
}

export function coerceValue(
  raw: string,
  type: FieldType,
  options: CoerceOptions = {}
): Primitive {
  const trimmed = raw.trim();
  switch (type) {
    case 'number': {
      const separator = options.thousandsSeparator;
      const candidate =
        separator && separator.length > 0 ? trimmed.split(separator).join('') : trimmed;
      const value = Number(candidate);
      return Number.isNaN(value) ? null : value;
    }
    case 'date': {
      const date = new Date(trimmed.replace(' ', 'T'));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    case 'boolean': {
      const token = trimmed.toLowerCase();
      if (TRUE_TOKENS.has(token)) return true;
      if (FALSE_TOKENS.has(token)) return false;
      return null;
    }
    case 'null':
      return null;
    case 'string':
      return raw;
  }
}

const TYPE_RANK: Record<FieldType, number> = {
  null: 0,
  boolean: 1,
  number: 2,
  date: 3,
  string: 4,
};

export function unifyTypes(a: FieldType, b: FieldType): FieldType {
  if (a === b) return a;
  if (a === 'null') return b;
  if (b === 'null') return a;
  if ((a === 'number' && b === 'date') || (a === 'date' && b === 'number')) return 'string';
  return TYPE_RANK[a] > TYPE_RANK[b] ? a : b;
}
