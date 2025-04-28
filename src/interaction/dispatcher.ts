export type Handler<Payload> = (payload: Payload) => void;

export type Unsubscribe = () => void;

export interface Dispatcher<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe;
  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe;
  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  listenerCount(type: keyof Events): number;
  clear(): void;
}

export function createDispatcher<
  Events extends Record<string, unknown>,
>(): Dispatcher<Events> {
  const registry = new Map<keyof Events, Set<Handler<never>>>();

  const handlersFor = (type: keyof Events): Set<Handler<never>> => {
    let handlers = registry.get(type);
    if (!handlers) {
      handlers = new Set();
      registry.set(type, handlers);
    }
    return handlers;
  };

  const dispatcher: Dispatcher<Events> = {
    on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
      handlersFor(type).add(handler as Handler<never>);
      return () => {
        dispatcher.off(type, handler);
      };
    },

    once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
      const wrapped: Handler<Events[K]> = (payload) => {
        dispatcher.off(type, wrapped);
        handler(payload);
      };
      return dispatcher.on(type, wrapped);
    },

    off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
      registry.get(type)?.delete(handler as Handler<never>);
    },

    emit<K extends keyof Events>(type: K, payload: Events[K]): void {
      const handlers = registry.get(type);
      if (!handlers || handlers.size === 0) return;
      for (const handler of [...handlers]) (handler as Handler<Events[K]>)(payload);
    },

    listenerCount(type: keyof Events): number {
      return registry.get(type)?.size ?? 0;
    },

    clear(): void {
      registry.clear();
    },
  };

  return dispatcher;
}
