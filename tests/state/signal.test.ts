import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  batch,
  computed,
  effect,
  flushSync,
  setScheduler,
  signal,
  untrack,
} from '@/state/signal.ts';

beforeEach(() => {
  setScheduler((flush) => {
    flush();
  });
});

describe('signal', () => {
  it('holds and updates a value', () => {
    const count = signal(1);
    expect(count()).toBe(1);
    count.set(2);
    expect(count()).toBe(2);
  });

  it('updates from the current value', () => {
    const count = signal(1);
    count.update((current) => current + 10);
    expect(count()).toBe(11);
  });

  it('reads without subscribing via peek', () => {
    const count = signal(1);
    const seen: number[] = [];
    effect(() => {
      seen.push(count.peek());
    });
    count.set(2);
    flushSync();
    expect(seen).toEqual([1]);
  });

  it('ignores writes that do not change the value', () => {
    const count = signal(1);
    const spy = vi.fn();
    effect(() => {
      count();
      spy();
    });
    spy.mockClear();
    count.set(1);
    flushSync();
    expect(spy).not.toHaveBeenCalled();
  });

  it('accepts a custom equality function', () => {
    const point = signal({ x: 1 }, (a, b) => a.x === b.x);
    const spy = vi.fn();
    effect(() => {
      point();
      spy();
    });
    spy.mockClear();
    point.set({ x: 1 });
    flushSync();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('computed', () => {
  it('derives from signals', () => {
    const width = signal(10);
    const doubled = computed(() => width() * 2);
    expect(doubled()).toBe(20);
    width.set(20);
    expect(doubled()).toBe(40);
  });

  it('recomputes lazily and only once per change', () => {
    const source = signal(1);
    const work = vi.fn(() => source() * 2);
    const derived = computed(work);

    expect(work).not.toHaveBeenCalled();
    derived();
    derived();
    expect(work).toHaveBeenCalledTimes(1);

    source.set(2);
    derived();
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('chains through several levels', () => {
    const base = signal(2);
    const squared = computed(() => base() * base());
    const label = computed(() => `value ${squared()}`);
    expect(label()).toBe('value 4');
    base.set(3);
    expect(label()).toBe('value 9');
  });

  it('does not notify when the derived value is unchanged', () => {
    const source = signal(1);
    const parity = computed(() => source() % 2);
    const spy = vi.fn();
    effect(() => {
      parity();
      spy();
    });
    spy.mockClear();

    source.set(3);
    flushSync();
    expect(spy).not.toHaveBeenCalled();

    source.set(2);
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('effect', () => {
  it('runs immediately and on dependency change', () => {
    const source = signal(1);
    const seen: number[] = [];
    effect(() => {
      seen.push(source());
    });
    source.set(2);
    flushSync();
    expect(seen).toEqual([1, 2]);
  });

  it('tracks dependencies dynamically', () => {
    const toggle = signal(true);
    const a = signal('a');
    const b = signal('b');
    const seen: string[] = [];

    effect(() => {
      seen.push(toggle() ? a() : b());
    });

    b.set('b2');
    flushSync();
    expect(seen).toEqual(['a']);

    toggle.set(false);
    flushSync();
    expect(seen).toEqual(['a', 'b2']);

    a.set('a2');
    flushSync();
    expect(seen).toEqual(['a', 'b2']);
  });

  it('runs the cleanup before each rerun and on dispose', () => {
    const source = signal(1);
    const cleanup = vi.fn();
    const dispose = effect(() => {
      source();
      return cleanup;
    });

    source.set(2);
    flushSync();
    expect(cleanup).toHaveBeenCalledTimes(1);

    dispose();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('stops reacting once disposed', () => {
    const source = signal(1);
    const spy = vi.fn();
    const dispose = effect(() => {
      source();
      spy();
    });
    dispose();
    source.set(2);
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('batch', () => {
  it('collapses several writes into one effect run', () => {
    const a = signal(1);
    const b = signal(2);
    const spy = vi.fn();
    effect(() => {
      a();
      b();
      spy();
    });
    spy.mockClear();

    batch(() => {
      a.set(10);
      b.set(20);
    });
    flushSync();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns the value produced by the body', () => {
    expect(batch(() => 42)).toBe(42);
  });

  it('supports nesting', () => {
    const source = signal(0);
    const spy = vi.fn();
    effect(() => {
      source();
      spy();
    });
    spy.mockClear();

    batch(() => {
      source.set(1);
      batch(() => {
        source.set(2);
      });
      source.set(3);
    });
    flushSync();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(source()).toBe(3);
  });
});

describe('untrack', () => {
  it('reads without creating a dependency', () => {
    const tracked = signal(1);
    const hidden = signal(1);
    const spy = vi.fn();

    effect(() => {
      tracked();
      untrack(() => hidden());
      spy();
    });
    spy.mockClear();

    hidden.set(2);
    flushSync();
    expect(spy).not.toHaveBeenCalled();

    tracked.set(2);
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('scheduler', () => {
  it('defers effect runs to the configured scheduler', () => {
    let queued: (() => void) | undefined;
    setScheduler((flush) => {
      queued = flush;
    });

    const source = signal(1);
    const spy = vi.fn();
    effect(() => {
      source();
      spy();
    });
    spy.mockClear();

    source.set(2);
    expect(spy).not.toHaveBeenCalled();

    queued?.();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
