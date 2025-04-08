import type { Primitive, Row } from '../types/data.ts';
import { toNumber, toStringKey } from '../utils/guards.ts';

export type ChannelName = 'x' | 'y' | 'color' | 'size' | 'opacity' | 'shape' | 'label';

export type ChannelResolver<Out> = (row: Row, index: number) => Out;

export interface ConstantChannel<Out> {
  readonly value: Out;
}

export interface FieldChannel<Out> {
  readonly field: string;
  readonly scale?: (value: never) => Out;
  readonly as?: 'number' | 'string' | 'raw';
}

export interface AccessorChannel<Out> {
  readonly accessor: ChannelResolver<Out>;
}

export type ChannelSpec<Out> =
  | ConstantChannel<Out>
  | FieldChannel<Out>
  | AccessorChannel<Out>
  | string
  | Out;

function isConstant<Out>(spec: ChannelSpec<Out>): spec is ConstantChannel<Out> {
  return typeof spec === 'object' && spec !== null && 'value' in spec;
}

function isField<Out>(spec: ChannelSpec<Out>): spec is FieldChannel<Out> {
  return typeof spec === 'object' && spec !== null && 'field' in spec;
}

function isAccessor<Out>(spec: ChannelSpec<Out>): spec is AccessorChannel<Out> {
  return typeof spec === 'object' && spec !== null && 'accessor' in spec;
}

export function fieldValue(row: Row, field: string): Primitive {
  return row[field] ?? null;
}

export function resolveChannel<Out>(spec: ChannelSpec<Out>): ChannelResolver<Out> {
  if (typeof spec === 'string') {
    return (row) => fieldValue(row, spec) as Out;
  }

  if (isAccessor(spec)) return spec.accessor;

  if (isConstant(spec)) {
    const { value } = spec;
    return () => value;
  }

  if (isField(spec)) {
    const { field, scale, as } = spec;
    if (!scale) {
      if (as === 'number') return (row) => toNumber(fieldValue(row, field)) as Out;
      if (as === 'string') return (row) => toStringKey(fieldValue(row, field)) as Out;
      return (row) => fieldValue(row, field) as Out;
    }
    const project = scale as (value: unknown) => Out;
    if (as === 'number') return (row) => project(toNumber(fieldValue(row, field)));
    if (as === 'string') return (row) => project(toStringKey(fieldValue(row, field)));
    return (row) => project(fieldValue(row, field));
  }

  return () => spec as Out;
}

export function channelDomain(rows: readonly Row[], field: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const key = toStringKey(fieldValue(row, field));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function numericExtent(
  rows: readonly Row[],
  field: string
): [number, number] | undefined {
  let lo: number | undefined;
  let hi: number | undefined;
  for (const row of rows) {
    const value = toNumber(fieldValue(row, field));
    if (Number.isNaN(value)) continue;
    if (lo === undefined || value < lo) lo = value;
    if (hi === undefined || value > hi) hi = value;
  }
  return lo === undefined || hi === undefined ? undefined : [lo, hi];
}

export function includeZero(extent: readonly [number, number]): [number, number] {
  return [Math.min(0, extent[0]), Math.max(0, extent[1])];
}
