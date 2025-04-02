import { shallowEqual } from '../utils/functional.ts';
import { batch, computed, effect, signal, type Cleanup, type ReadSignal } from './signal.ts';

export interface Store<T extends object> {
  readonly state: ReadSignal<T>;
  get(): T;
  set(next: T): void;
  patch(partial: Partial<T>): void;
  select<R>(selector: (state: T) => R, equals?: (a: R, b: R) => boolean): ReadSignal<R>;
  subscribe(listener: (state: T) => void): Cleanup;
  reset(): void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  const source = signal<T>(initial, shallowEqual);
  const selectors = new Map<(state: T) => unknown, ReadSignal<unknown>>();

  return {
    state: source,

    get(): T {
      return source.peek();
    },

    set(next: T): void {
      source.set(next);
    },

    patch(partial: Partial<T>): void {
      const current = source.peek();
      let changed = false;
      for (const key of Object.keys(partial) as (keyof T)[]) {
        if (!Object.is(current[key], partial[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      source.set({ ...current, ...partial });
    },

    select<R>(selector: (state: T) => R, equals?: (a: R, b: R) => boolean): ReadSignal<R> {
      const cached = selectors.get(selector as (state: T) => unknown);
      if (cached) return cached as ReadSignal<R>;
      const derived = computed<R>(() => selector(source()), equals);
      selectors.set(selector as (state: T) => unknown, derived as ReadSignal<unknown>);
      return derived;
    },

    subscribe(listener: (state: T) => void): Cleanup {
      return effect(() => {
        listener(source());
      });
    },

    reset(): void {
      batch(() => {
        source.set(initial);
      });
    },
  };
}
