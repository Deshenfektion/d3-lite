import type { Dataset, Row } from '../../types/data.ts';
import type { Transform } from './types.ts';

export function pipeline(...transforms: readonly Transform[]): Transform {
  if (transforms.length === 0) return (dataset) => dataset;
  if (transforms.length === 1) return transforms[0] as Transform;
  return (dataset) => {
    let current = dataset;
    for (const transform of transforms) current = transform(current);
    return current;
  };
}

export class Pipe {
  private constructor(private readonly dataset: Dataset) {}

  static from(dataset: Dataset): Pipe {
    return new Pipe(dataset);
  }

  apply(...transforms: readonly Transform[]): Pipe {
    return new Pipe(pipeline(...transforms)(this.dataset));
  }

  tap(visitor: (dataset: Dataset) => void): this {
    visitor(this.dataset);
    return this;
  }

  toDataset(): Dataset {
    return this.dataset;
  }

  toRows(): readonly Row[] {
    return this.dataset.rows;
  }
}

export const from = (dataset: Dataset): Pipe => Pipe.from(dataset);
