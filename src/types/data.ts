export type Primitive = string | number | boolean | Date | null;

export type Row = Record<string, Primitive>;

export type FieldType = 'number' | 'string' | 'boolean' | 'date' | 'null';

export interface FieldSchema {
  readonly name: string;
  readonly type: FieldType;
  readonly nullable: boolean;
  readonly missing: number;
}

export interface Schema {
  readonly fields: readonly FieldSchema[];
  readonly rowCount: number;
}

export interface Dataset {
  readonly rows: readonly Row[];
  readonly schema: Schema;
  readonly source?: string;
}

export type Accessor<T, R> = (datum: T, index: number) => R;

export type FieldRef<T = Row> = string | Accessor<T, Primitive>;

export interface ParseIssue {
  readonly kind: 'ragged-row' | 'unparsable-value' | 'duplicate-field' | 'empty-input';
  readonly message: string;
  readonly row?: number;
  readonly field?: string;
}

export interface ParseResult {
  readonly dataset: Dataset;
  readonly issues: readonly ParseIssue[];
}
