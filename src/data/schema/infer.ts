import type { FieldSchema, FieldType, Primitive, Row, Schema } from '../../types/data.ts';
import { unifyTypes } from '../parser/coerce.ts';

export interface InferSchemaOptions {
  sampleSize?: number;
  fieldOrder?: readonly string[];
}

export function typeOfValue(value: Primitive): FieldType {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isNaN(value) ? 'null' : 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  return 'string';
}

export function inferSchema(rows: readonly Row[], options: InferSchemaOptions = {}): Schema {
  const sampleSize = Math.min(rows.length, options.sampleSize ?? rows.length);
  const names: string[] = options.fieldOrder ? [...options.fieldOrder] : [];
  const seen = new Set(names);
  const types = new Map<string, FieldType>();
  const missing = new Map<string, number>();

  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    if (row === undefined) continue;
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }

  for (const name of names) {
    types.set(name, 'null');
    missing.set(name, 0);
  }

  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    if (row === undefined) continue;
    for (const name of names) {
      const value = Object.hasOwn(row, name) ? row[name] : null;
      const valueType = typeOfValue(value ?? null);
      if (valueType === 'null') {
        missing.set(name, (missing.get(name) ?? 0) + 1);
        continue;
      }
      types.set(name, unifyTypes(types.get(name) ?? 'null', valueType));
    }
  }

  const fields: FieldSchema[] = names.map((name) => {
    const missingCount = missing.get(name) ?? 0;
    return {
      name,
      type: types.get(name) ?? 'null',
      nullable: missingCount > 0,
      missing: missingCount,
    };
  });

  return { fields, rowCount: rows.length };
}

export function schemaField(schema: Schema, name: string): FieldSchema | undefined {
  return schema.fields.find((field) => field.name === name);
}

export function fieldNames(schema: Schema): string[] {
  return schema.fields.map((field) => field.name);
}

export function fieldsOfType(schema: Schema, type: FieldType): string[] {
  return schema.fields.filter((field) => field.type === type).map((field) => field.name);
}
