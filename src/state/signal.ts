export type Cleanup = () => void;

export type Equality<T> = (a: T, b: T) => boolean;

export interface ReadSignal<T> {
  (): T;
  peek(): T;
}

export interface WriteSignal<T> extends ReadSignal<T> {
  set(value: T): void;
  update(updater: (current: T) => T): void;
}

interface Node {
  observers: Set<Computation>;
  version: number;
  pull?: () => void;
}

interface Computation {
  dependencies: Set<Node>;
  seenVersions: Map<Node, number>;
  stale: boolean;
  disposed: boolean;
  isEffect: boolean;
  output?: Node;
  execute(): void;
}

let activeComputation: Computation | undefined;
let batchDepth = 0;
const pendingEffects = new Set<Computation>();
let scheduled = false;

export type Scheduler = (flush: () => void) => void;

let scheduler: Scheduler = (flush) => {
  queueMicrotask(flush);
};

export function setScheduler(next: Scheduler): void {
  scheduler = next;
}

function unlink(computation: Computation): void {
  for (const dependency of computation.dependencies) {
    dependency.observers.delete(computation);
  }
  computation.dependencies.clear();
  computation.seenVersions.clear();
}

function track(node: Node): void {
  const computation = activeComputation;
  if (!computation) return;
  node.observers.add(computation);
  computation.dependencies.add(node);
  computation.seenVersions.set(node, node.version);
}

function markStale(computation: Computation): void {
  if (computation.stale || computation.disposed) return;
  computation.stale = true;
  if (computation.isEffect) {
    pendingEffects.add(computation);
    return;
  }
  const output = computation.output;
  if (!output) return;
  for (const observer of [...output.observers]) markStale(observer);
}

function bump(node: Node): void {
  node.version++;
  for (const observer of [...node.observers]) markStale(observer);
}

function dependenciesChanged(computation: Computation): boolean {
  for (const dependency of computation.dependencies) {
    dependency.pull?.();
    if (dependency.version !== computation.seenVersions.get(dependency)) return true;
  }
  return false;
}

export function flushSync(): void {
  scheduled = false;
  let guard = 0;
  while (pendingEffects.size > 0 && guard < 1000) {
    guard++;
    const queue = [...pendingEffects];
    pendingEffects.clear();
    for (const computation of queue) {
      if (computation.disposed) continue;
      if (!dependenciesChanged(computation)) {
        computation.stale = false;
        continue;
      }
      computation.execute();
    }
  }
}

function schedule(): void {
  if (scheduled || batchDepth > 0) return;
  scheduled = true;
  scheduler(() => {
    scheduled = false;
    flushSync();
  });
}

export function signal<T>(initial: T, equals: Equality<T> = Object.is): WriteSignal<T> {
  const node: Node = { observers: new Set(), version: 0 };
  let value = initial;

  const read = (() => {
    track(node);
    return value;
  }) as WriteSignal<T>;

  read.peek = () => value;

  read.set = (next: T): void => {
    if (equals(value, next)) return;
    value = next;
    bump(node);
    schedule();
  };

  read.update = (updater: (current: T) => T): void => {
    read.set(updater(value));
  };

  return read;
}

export function computed<T>(compute: () => T, equals: Equality<T> = Object.is): ReadSignal<T> {
  const node: Node = { observers: new Set(), version: 0 };
  let value: T;
  let initialized = false;

  const computation: Computation = {
    dependencies: new Set(),
    seenVersions: new Map(),
    stale: true,
    disposed: false,
    isEffect: false,
    output: node,
    execute(): void {
      const previous = activeComputation;
      unlink(computation);
      activeComputation = computation;
      try {
        const next = compute();
        const changed = !initialized || !equals(value, next);
        value = next;
        initialized = true;
        computation.stale = false;
        if (changed) node.version++;
      } finally {
        activeComputation = previous;
      }
    },
  };

  node.pull = (): void => {
    if (computation.stale) computation.execute();
  };

  const read = (() => {
    if (computation.stale) computation.execute();
    track(node);
    return value;
  }) as ReadSignal<T>;

  read.peek = () => {
    if (computation.stale) computation.execute();
    return value;
  };

  return read;
}

export function effect(run: () => void | Cleanup): Cleanup {
  let cleanup: Cleanup | undefined;

  const computation: Computation = {
    dependencies: new Set(),
    seenVersions: new Map(),
    stale: false,
    disposed: false,
    isEffect: true,
    execute(): void {
      if (computation.disposed) return;
      cleanup?.();
      cleanup = undefined;
      computation.stale = false;
      const previous = activeComputation;
      unlink(computation);
      activeComputation = computation;
      try {
        const result = run();
        if (typeof result === 'function') cleanup = result;
      } finally {
        activeComputation = previous;
      }
    },
  };

  computation.execute();

  return () => {
    if (computation.disposed) return;
    computation.disposed = true;
    cleanup?.();
    unlink(computation);
    pendingEffects.delete(computation);
  };
}

export function batch<T>(body: () => T): T {
  batchDepth++;
  try {
    return body();
  } finally {
    batchDepth--;
    if (batchDepth === 0) schedule();
  }
}

export function untrack<T>(body: () => T): T {
  const previous = activeComputation;
  activeComputation = undefined;
  try {
    return body();
  } finally {
    activeComputation = previous;
  }
}
