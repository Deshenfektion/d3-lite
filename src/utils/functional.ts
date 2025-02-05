export function identity<T>(value: T): T {
  return value;
}

export function constant<T>(value: T): () => T {
  return () => value;
}

export function noop(): void {
  return undefined;
}

export function memoizeOne<A, R>(fn: (arg: A) => R): (arg: A) => R {
  let lastArg: A | undefined;
  let lastResult: R | undefined;
  let primed = false;
  return (arg: A): R => {
    if (primed && Object.is(arg, lastArg)) return lastResult as R;
    lastResult = fn(arg);
    lastArg = arg;
    primed = true;
    return lastResult;
  };
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b as Record<string, unknown>, key)) return false;
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}
