import { describe, expect, it } from 'vitest';
import { detectDelimiter, tokenizeDelimited } from '@/data/parser/delimited.ts';
import { parseCSV, parseTSV } from '@/data/parser/csv.ts';
import { flattenObject, parseJSON } from '@/data/parser/json.ts';
import { detectFormat, parse, parseAll } from '@/data/parser/index.ts';

describe('tokenizeDelimited', () => {
  it('splits simple rows', () => {
    expect(tokenizeDelimited('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('honours quoted fields containing delimiters', () => {
    expect(tokenizeDelimited('name,note\n"Doe, Jane",ok')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'ok'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(tokenizeDelimited('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('supports embedded newlines inside quotes', () => {
    expect(tokenizeDelimited('a,b\n"line1\nline2",2')).toEqual([
      ['a', 'b'],
      ['line1\nline2', '2'],
    ]);
  });

  it('handles CRLF and lone CR line endings', () => {
    expect(tokenizeDelimited('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(tokenizeDelimited('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a byte order mark', () => {
    expect(tokenizeDelimited('﻿a,b\n1,2')[0]).toEqual(['a', 'b']);
  });

  it('preserves trailing empty fields', () => {
    expect(tokenizeDelimited('a,b,c\n1,,')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ]);
  });

  it('skips comment lines when configured', () => {
    const rows = tokenizeDelimited('# note\na,b\n1,2', { comment: '#' });
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('respects maxRows', () => {
    expect(tokenizeDelimited('a\n1\n2\n3', { maxRows: 2 })).toHaveLength(2);
  });
});

describe('detectDelimiter', () => {
  it('picks the dominant delimiter on the header line', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a,b,c,d";x\n1;2')).toBe(';');
  });
});

describe('parseCSV', () => {
  const csv = 'region,units,active,recorded\nNorth,120,true,2025-03-01\nSouth,,false,2025-03-02';

  it('infers column types', () => {
    const { dataset } = parseCSV(csv);
    const types = Object.fromEntries(dataset.schema.fields.map((f) => [f.name, f.type]));
    expect(types).toEqual({
      region: 'string',
      units: 'number',
      active: 'boolean',
      recorded: 'date',
    });
  });

  it('coerces values to their inferred type', () => {
    const { dataset } = parseCSV(csv);
    const first = dataset.rows[0]!;
    expect(first.region).toBe('North');
    expect(first.units).toBe(120);
    expect(first.active).toBe(true);
    expect(first.recorded).toBeInstanceOf(Date);
  });

  it('treats blank and sentinel tokens as missing', () => {
    const { dataset } = parseCSV(csv);
    expect(dataset.rows[1]!.units).toBeNull();
    const field = dataset.schema.fields.find((f) => f.name === 'units')!;
    expect(field.nullable).toBe(true);
    expect(field.missing).toBe(1);
  });

  it('reports ragged rows without discarding them', () => {
    const { dataset, issues } = parseCSV('a,b\n1,2\n3');
    expect(dataset.rows).toHaveLength(2);
    expect(issues.some((issue) => issue.kind === 'ragged-row')).toBe(true);
    expect(dataset.rows[1]!.b).toBeNull();
  });

  it('renames duplicate headers', () => {
    const { dataset, issues } = parseCSV('a,a\n1,2');
    expect(dataset.schema.fields.map((f) => f.name)).toEqual(['a', 'a_2']);
    expect(issues.some((issue) => issue.kind === 'duplicate-field')).toBe(true);
  });

  it('supports headerless input', () => {
    const { dataset } = parseCSV('1,2\n3,4', { header: false });
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]!.column_1).toBe(1);
  });

  it('accepts explicit type overrides', () => {
    const { dataset } = parseCSV('id\n007', { types: { id: 'string' } });
    expect(dataset.rows[0]!.id).toBe('007');
  });

  it('understands thousands separators when configured', () => {
    const { dataset } = parseCSV('total\n1,234', {
      delimiter: ';',
      thousandsSeparator: ',',
    });
    expect(dataset.rows[0]!.total).toBe(1234);
  });

  it('flags empty input', () => {
    const { dataset, issues } = parseCSV('');
    expect(dataset.rows).toHaveLength(0);
    expect(issues[0]!.kind).toBe('empty-input');
  });

  it('falls back to string for mixed columns', () => {
    const { dataset } = parseCSV('v\n1\nabc');
    expect(dataset.schema.fields[0]!.type).toBe('string');
  });
});

describe('parseTSV', () => {
  it('reads tab separated values', () => {
    const { dataset } = parseTSV('a\tb\n1\t2');
    expect(dataset.rows[0]).toEqual({ a: 1, b: 2 });
  });
});

describe('flattenObject', () => {
  it('flattens nested objects with dotted paths', () => {
    expect(flattenObject({ a: { b: { c: 1 } }, d: 2 })).toEqual({ 'a.b.c': 1, d: 2 });
  });

  it('indexes array members by default', () => {
    expect(flattenObject({ tags: ['x', 'y'] })).toEqual({ 'tags.0': 'x', 'tags.1': 'y' });
  });

  it('can join arrays into a single string', () => {
    expect(flattenObject({ tags: ['x', 'y'] }, { arrays: 'join' })).toEqual({ tags: 'x, y' });
  });

  it('can drop arrays entirely', () => {
    expect(flattenObject({ tags: ['x'], id: 1 }, { arrays: 'drop' })).toEqual({ id: 1 });
  });

  it('stringifies beyond the depth limit', () => {
    const result = flattenObject({ a: { b: { c: 1 } } }, { maxDepth: 2 });
    expect(result['a.b']).toBe('{"c":1}');
  });
});

describe('parseJSON', () => {
  it('reads an array of records', () => {
    const { dataset } = parseJSON('[{"a":1},{"a":2}]');
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.schema.fields[0]!.type).toBe('number');
  });

  it('wraps a single object', () => {
    const { dataset } = parseJSON({ a: 1 });
    expect(dataset.rows).toHaveLength(1);
  });

  it('reads records from a nested path', () => {
    const { dataset } = parseJSON({ result: { items: [{ a: 1 }] } }, { path: 'result.items' });
    expect(dataset.rows).toEqual([{ a: 1 }]);
  });

  it('reports invalid JSON instead of throwing', () => {
    const { issues } = parseJSON('{not json');
    expect(issues[0]!.kind).toBe('unparsable-value');
  });

  it('reports empty payloads', () => {
    const { issues } = parseJSON('[]');
    expect(issues[0]!.kind).toBe('empty-input');
  });
});

describe('format detection', () => {
  it('recognises json, csv and tsv strings', () => {
    expect(detectFormat('[{"a":1}]')).toBe('json');
    expect(detectFormat('a,b\n1,2')).toBe('csv');
    expect(detectFormat('a\tb\n1\t2')).toBe('tsv');
  });

  it('recognises in-memory row arrays', () => {
    expect(detectFormat([{ a: 1 }])).toBe('rows');
  });

  it('routes through the unified parse entry point', () => {
    expect(parse('a,b\n1,2').dataset.rows[0]).toEqual({ a: 1, b: 2 });
    expect(parse([{ a: 1 }]).dataset.rows[0]).toEqual({ a: 1 });
  });
});

describe('parseAll', () => {
  it('parses several named sources at once', () => {
    const results = parseAll([
      { name: 'sales', input: 'a\n1' },
      { name: 'targets', input: '[{"b":2}]' },
    ]);
    expect(results.get('sales')!.dataset.rows[0]).toEqual({ a: 1 });
    expect(results.get('targets')!.dataset.source).toBe('targets');
  });
});
