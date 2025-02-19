import type { Dataset, Primitive, Row } from '../../types/data.ts';

export type Transform = (dataset: Dataset) => Dataset;

export type RowPredicate = (row: Row, index: number) => boolean;

export type RowMapper = (row: Row, index: number) => Row;

export type ValueAccessor = (row: Row, index: number) => Primitive;

export type Comparator = (a: Row, b: Row) => number;
