import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effect, flushSync, setScheduler } from '@/state/signal.ts';
import { createStore } from '@/state/store.ts';

beforeEach(() => {
  setScheduler((flush) => {
    flush();
  });
});

describe('createStore', () => {
  interface ChartState {
    metric: string;
    limit: number;
  }

  it('exposes and patches state', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    expect(store.get().metric).toBe('revenue');
    store.patch({ limit: 20 });
    expect(store.get()).toEqual({ metric: 'revenue', limit: 20 });
  });

  it('ignores patches that change nothing', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    const spy = vi.fn();
    store.subscribe(spy);
    spy.mockClear();

    store.patch({ limit: 10 });
    flushSync();
    expect(spy).not.toHaveBeenCalled();
  });

  it('derives selectors that only fire when their slice changes', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    const metric = store.select((state) => state.metric);
    const spy = vi.fn();

    effect(() => {
      metric();
      spy();
    });
    spy.mockClear();

    store.patch({ limit: 99 });
    flushSync();
    expect(spy).not.toHaveBeenCalled();

    store.patch({ metric: 'units' });
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('caches selectors by function identity', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    const selector = (state: ChartState) => state.limit;
    expect(store.select(selector)).toBe(store.select(selector));
  });

  it('notifies subscribers and can be reset', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.limit));

    store.patch({ limit: 20 });
    flushSync();
    store.reset();
    flushSync();

    expect(seen).toEqual([10, 20, 10]);
  });

  it('unsubscribes cleanly', () => {
    const store = createStore<ChartState>({ metric: 'revenue', limit: 10 });
    const spy = vi.fn();
    const dispose = store.subscribe(spy);
    dispose();
    store.patch({ limit: 50 });
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
