import { describe, expect, it } from 'vitest';
import { createDataset } from '@/data/dataset.ts';
import { fieldsOfType, inferSchema, schemaField, typeOfValue } from '@/data/schema/infer.ts';
import { assertValid, validateDataset } from '@/data/schema/validate.ts';
import { unifyTypes } from '@/data/parser/coerce.ts';

describe('typeOfValue', () => {
  it('classifies primitives', () => {
    expect(typeOfValue(1)).toBe('number');
    expect(typeOfValue('a')).toBe('string');
    expect(typeOfValue(true)).toBe('boolean');
    expect(typeOfValue(new Date())).toBe('date');
    expect(typeOfValue(null)).toBe('null');
    expect(typeOfValue(Number.NaN)).toBe('null');
  });
});

describe('unifyTypes', () => {
  it('absorbs nulls into the concrete type', () => {
    expect(unifyTypes('null', 'number')).toBe('number');
    expect(unifyTypes('number', 'null')).toBe('number');
  });

  it('widens conflicting types to string', () => {
    expect(unifyTypes('number', 'string')).toBe('string');
    expect(unifyTypes('number', 'date')).toBe('string');
    expect(unifyTypes('boolean', 'number')).toBe('number');
  });
});

describe('inferSchema', () => {
  it('collects fields across heterogeneous rows', () => {
    const schema = inferSchema([{ a: 1 }, { b: 'x' }]);
    expect(schema.fields.map((f) => f.name)).toEqual(['a', 'b']);
    expect(schema.rowCount).toBe(2);
  });

  it('counts missing values per field', () => {
    const schema = inferSchema([{ a: 1 }, { a: null }, { a: 3 }]);
    expect(schema.fields[0]).toMatchObject({ type: 'number', nullable: true, missing: 1 });
  });

  it('respects an explicit field order', () => {
    const schema = inferSchema([{ b: 1, a: 2 }], { fieldOrder: ['a', 'b'] });
    expect(schema.fields.map((f) => f.name)).toEqual(['a', 'b']);
  });

  it('samples a prefix when asked', () => {
    const rows = [{ a: 1 }, { a: 2 }, { a: 'text' }];
    expect(inferSchema(rows, { sampleSize: 2 }).fields[0]!.type).toBe('number');
    expect(inferSchema(rows).fields[0]!.type).toBe('string');
  });

  it('looks up fields by name and type', () => {
    const schema = inferSchema([{ a: 1, b: 'x' }]);
    expect(schemaField(schema, 'a')!.type).toBe('number');
    expect(schemaField(schema, 'zz')).toBeUndefined();
    expect(fieldsOfType(schema, 'string')).toEqual(['b']);
  });
});

describe('validateDataset', () => {
  const dataset = createDataset([
    { id: 1, score: 50, grade: 'A' },
    { id: 2, score: 150, grade: 'Z' },
    { id: 3, score: null, grade: 'B' },
  ]);

  it('passes when expectations are met', () => {
    const result = validateDataset(dataset, [{ name: 'id', type: 'number' }]);
    expect(result.valid).toBe(true);
    expect(result.problems).toHaveLength(0);
  });

  it('reports missing required fields', () => {
    const result = validateDataset(dataset, [{ name: 'absent' }]);
    expect(result.valid).toBe(false);
    expect(result.problems[0]!.message).toContain('Missing required field');
  });

  it('allows optional fields to be absent', () => {
    expect(validateDataset(dataset, [{ name: 'absent', required: false }]).valid).toBe(true);
  });

  it('reports type mismatches', () => {
    const result = validateDataset(dataset, [{ name: 'grade', type: 'number' }]);
    expect(result.problems[0]!.message).toContain('to be number');
  });

  it('reports unexpected nulls', () => {
    const result = validateDataset(dataset, [{ name: 'score', nullable: false }]);
    expect(result.valid).toBe(false);
  });

  it('reports out-of-range numbers with row indices', () => {
    const result = validateDataset(dataset, [{ name: 'score', min: 0, max: 100 }]);
    expect(result.problems[0]!.rows).toEqual([1]);
  });

  it('warns about values outside an allowed set without failing', () => {
    const result = validateDataset(dataset, [{ name: 'grade', oneOf: ['A', 'B'] }]);
    expect(result.valid).toBe(true);
    expect(result.problems[0]!.severity).toBe('warning');
  });

  it('throws from assertValid on error severity', () => {
    expect(() => assertValid(dataset, [{ name: 'absent' }])).toThrow(/validation failed/);
    expect(assertValid(dataset, [{ name: 'id' }])).toBe(dataset);
  });
});
