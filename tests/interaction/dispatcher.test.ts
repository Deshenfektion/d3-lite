import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from '@/interaction/dispatcher.ts';

interface Events extends Record<string, unknown> {
  hover: { id: string };
  leave: undefined;
}

describe('createDispatcher', () => {
  it('delivers payloads to handlers', () => {
    const dispatcher = createDispatcher<Events>();
    const spy = vi.fn();
    dispatcher.on('hover', spy);
    dispatcher.emit('hover', { id: 'a' });
    expect(spy).toHaveBeenCalledWith({ id: 'a' });
  });

  it('supports several handlers per event', () => {
    const dispatcher = createDispatcher<Events>();
    const first = vi.fn();
    const second = vi.fn();
    dispatcher.on('hover', first);
    dispatcher.on('hover', second);
    dispatcher.emit('hover', { id: 'a' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes through the returned handle', () => {
    const dispatcher = createDispatcher<Events>();
    const spy = vi.fn();
    const off = dispatcher.on('hover', spy);
    off();
    dispatcher.emit('hover', { id: 'a' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('unsubscribes through off', () => {
    const dispatcher = createDispatcher<Events>();
    const spy = vi.fn();
    dispatcher.on('hover', spy);
    dispatcher.off('hover', spy);
    dispatcher.emit('hover', { id: 'a' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('fires once handlers exactly once', () => {
    const dispatcher = createDispatcher<Events>();
    const spy = vi.fn();
    dispatcher.once('hover', spy);
    dispatcher.emit('hover', { id: 'a' });
    dispatcher.emit('hover', { id: 'b' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ignores events with no listeners', () => {
    const dispatcher = createDispatcher<Events>();
    expect(() => {
      dispatcher.emit('leave', undefined);
    }).not.toThrow();
  });

  it('tolerates unsubscribing during dispatch', () => {
    const dispatcher = createDispatcher<Events>();
    const second = vi.fn();
    const first = vi.fn(() => {
      dispatcher.off('hover', second);
    });
    dispatcher.on('hover', first);
    dispatcher.on('hover', second);
    expect(() => {
      dispatcher.emit('hover', { id: 'a' });
    }).not.toThrow();
  });

  it('reports and clears listeners', () => {
    const dispatcher = createDispatcher<Events>();
    dispatcher.on('hover', vi.fn());
    expect(dispatcher.listenerCount('hover')).toBe(1);
    dispatcher.clear();
    expect(dispatcher.listenerCount('hover')).toBe(0);
  });
});
