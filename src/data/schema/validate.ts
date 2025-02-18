import type { Dataset, FieldType, Primitive } from '../../types/data.ts';
import { columnOf } from '../dataset.ts';
import { schemaField } from './infer.ts';

export interface FieldExpectation {
  readonly name: string;
  readonly type?: FieldType;
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly oneOf?: readonly Primitive[];
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationProblem {
  readonly field: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly rows?: readonly number[];
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly problems: readonly ValidationProblem[];
}

const MAX_REPORTED_ROWS = 10;

export function validateDataset(
  dataset: Dataset,
  expectations: readonly FieldExpectation[]
): ValidationResult {
  const problems: ValidationProblem[] = [];

  for (const expectation of expectations) {
    const field = schemaField(dataset.schema, expectation.name);

    if (!field) {
      if (expectation.required !== false) {
        problems.push({
          field: expectation.name,
          severity: 'error',
          message: `Missing required field "${expectation.name}"`,
        });
      }
      continue;
    }

    if (expectation.type && field.type !== expectation.type && field.type !== 'null') {
      problems.push({
        field: field.name,
        severity: 'error',
        message: `Expected field "${field.name}" to be ${expectation.type} but found ${field.type}`,
      });
    }

    if (expectation.nullable === false && field.nullable) {
      problems.push({
        field: field.name,
        severity: 'error',
        message: `Field "${field.name}" contains ${field.missing} missing values`,
      });
    }

    const needsScan =
      expectation.min !== undefined || expectation.max !== undefined || expectation.oneOf;
    if (!needsScan) continue;

    const column = columnOf(dataset, field.name);
    const outOfRange: number[] = [];
    const notAllowed: number[] = [];
    const allowed = expectation.oneOf ? new Set(expectation.oneOf) : undefined;

    for (let i = 0; i < column.length; i++) {
      const value = column[i] ?? null;
      if (value === null) continue;
      if (typeof value === 'number') {
        if (expectation.min !== undefined && value < expectation.min) outOfRange.push(i);
        else if (expectation.max !== undefined && value > expectation.max) outOfRange.push(i);
      }
      if (allowed && !allowed.has(value)) notAllowed.push(i);
    }

    if (outOfRange.length > 0) {
      problems.push({
        field: field.name,
        severity: 'error',
        message: `${outOfRange.length} values in "${field.name}" fall outside the expected range`,
        rows: outOfRange.slice(0, MAX_REPORTED_ROWS),
      });
    }

    if (notAllowed.length > 0) {
      problems.push({
        field: field.name,
        severity: 'warning',
        message: `${notAllowed.length} values in "${field.name}" are outside the allowed set`,
        rows: notAllowed.slice(0, MAX_REPORTED_ROWS),
      });
    }
  }

  return {
    valid: !problems.some((problem) => problem.severity === 'error'),
    problems,
  };
}

export function assertValid(
  dataset: Dataset,
  expectations: readonly FieldExpectation[]
): Dataset {
  const result = validateDataset(dataset, expectations);
  if (!result.valid) {
    const summary = result.problems
      .filter((problem) => problem.severity === 'error')
      .map((problem) => problem.message)
      .join('; ');
    throw new Error(`Dataset validation failed: ${summary}`);
  }
  return dataset;
}

export * from './infer.ts';
