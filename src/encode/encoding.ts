import type { Row } from '../types/data.ts';
import { resolveChannel, type ChannelResolver, type ChannelSpec } from './channel.ts';

export interface EncodingSpec {
  readonly x?: ChannelSpec<number>;
  readonly y?: ChannelSpec<number>;
  readonly color?: ChannelSpec<string>;
  readonly size?: ChannelSpec<number>;
  readonly opacity?: ChannelSpec<number>;
  readonly shape?: ChannelSpec<string>;
  readonly label?: ChannelSpec<string>;
  readonly key?: ChannelSpec<string>;
}

export interface ResolvedEncoding {
  readonly x: ChannelResolver<number>;
  readonly y: ChannelResolver<number>;
  readonly color: ChannelResolver<string>;
  readonly size: ChannelResolver<number>;
  readonly opacity: ChannelResolver<number>;
  readonly shape: ChannelResolver<string>;
  readonly label: ChannelResolver<string>;
  readonly key: ChannelResolver<string>;
}

export interface EncodingDefaults {
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
  readonly shape?: string;
}

export function resolveEncoding(
  spec: EncodingSpec,
  defaults: EncodingDefaults = {}
): ResolvedEncoding {
  return {
    x: spec.x === undefined ? () => Number.NaN : resolveChannel(spec.x),
    y: spec.y === undefined ? () => Number.NaN : resolveChannel(spec.y),
    color: spec.color === undefined
      ? () => defaults.color ?? '#2a78d6'
      : resolveChannel(spec.color),
    size: spec.size === undefined ? () => defaults.size ?? 8 : resolveChannel(spec.size),
    opacity: spec.opacity === undefined
      ? () => defaults.opacity ?? 1
      : resolveChannel(spec.opacity),
    shape: spec.shape === undefined
      ? () => defaults.shape ?? 'circle'
      : resolveChannel(spec.shape),
    label: spec.label === undefined ? () => '' : resolveChannel(spec.label),
    key: spec.key === undefined ? (_, index) => String(index) : resolveChannel(spec.key),
  };
}

export interface EncodedMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly size: number;
  readonly opacity: number;
  readonly shape: string;
  readonly label: string;
  readonly datum: Row;
  readonly index: number;
}

export function encodeRows(
  rows: readonly Row[],
  encoding: ResolvedEncoding
): EncodedMark[] {
  const out: EncodedMark[] = new Array<EncodedMark>(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Row;
    out[i] = {
      key: encoding.key(row, i),
      x: encoding.x(row, i),
      y: encoding.y(row, i),
      color: encoding.color(row, i),
      size: encoding.size(row, i),
      opacity: encoding.opacity(row, i),
      shape: encoding.shape(row, i),
      label: encoding.label(row, i),
      datum: row,
      index: i,
    };
  }
  return out;
}
