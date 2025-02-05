import type { Primitive, Row } from '../types/data.ts';

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  );
}

export function isRow(value: unknown): value is Row {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (!isPrimitive(value[key])) return false;
  }
  return true;
}

export function toNumber(value: Primitive): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (value === null) return Number.NaN;
  const parsed = Number(value);
  return parsed;
}

export function toStringKey(value: Primitive): string {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
