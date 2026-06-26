/**
 * A tiny, strongly-typed event bus with middleware support.
 *
 * Design goals:
 *   - **Decoupled** — emitters never know who listens; the viewer, autosave,
 *     analytics and (later) a collaboration transport all subscribe here.
 *   - **Typed** — `emit`/`on` are keyed by an event map, so payloads are checked
 *     at compile time and there are no stringly-typed mistakes.
 *   - **Middleware** — cross-cutting concerns (logging, throttling, recording an
 *     op-log for collaboration) wrap every emit without touching subscribers.
 *
 * Subscriber errors are isolated: one throwing handler never prevents the others
 * from running, which keeps a buggy panel from breaking the whole editor.
 */

export interface EventMeta {
  /** The event type as a string (handy inside generic middleware/logging). */
  type: string;
  /** Wall-clock time the event was emitted. */
  timestamp: number;
}

export type EventHandler<P> = (payload: P, meta: EventMeta) => void;

export interface EmittedEvent<M, K extends keyof M = keyof M> {
  type: K;
  payload: M[K];
  meta: EventMeta;
}

/**
 * Middleware runs for every emit, in registration order. Call `next()` to
 * continue the chain (and ultimately deliver to subscribers); omit it to drop
 * the event.
 */
export type EventMiddleware<M> = (event: EmittedEvent<M>, next: () => void) => void;

export class TypedEventBus<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<EventHandler<unknown>>>();
  private anyHandlers = new Set<(event: EmittedEvent<M>) => void>();
  private middlewares: EventMiddleware<M>[] = [];

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<K extends keyof M>(type: K, handler: EventHandler<M[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => this.off(type, handler);
  }

  /** Subscribe and auto-unsubscribe after the first matching event. */
  once<K extends keyof M>(type: K, handler: EventHandler<M[K]>): () => void {
    const off = this.on(type, (payload, meta) => {
      off();
      handler(payload, meta);
    });
    return off;
  }

  off<K extends keyof M>(type: K, handler: EventHandler<M[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<unknown>);
  }

  /** Subscribe to *every* event (e.g. for a debug logger). */
  onAny(handler: (event: EmittedEvent<M>) => void): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  /** Register middleware. Returns a function that removes it. */
  use(middleware: EventMiddleware<M>): () => void {
    this.middlewares.push(middleware);
    return () => {
      const i = this.middlewares.indexOf(middleware);
      if (i !== -1) this.middlewares.splice(i, 1);
    };
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const meta: EventMeta = { type: String(type), timestamp: Date.now() };
    const event: EmittedEvent<M> = { type, payload, meta };

    const run = (index: number): void => {
      if (index < this.middlewares.length) {
        let advanced = false;
        this.middlewares[index](event, () => {
          if (advanced) return; // guard against double-next
          advanced = true;
          run(index + 1);
        });
        return;
      }
      this.dispatch(type, payload, meta, event);
    };
    run(0);
  }

  private dispatch<K extends keyof M>(
    type: K,
    payload: M[K],
    meta: EventMeta,
    event: EmittedEvent<M>,
  ): void {
    const set = this.handlers.get(type);
    if (set) {
      // Copy so handlers can unsubscribe during iteration safely.
      for (const handler of [...set]) {
        try {
          (handler as EventHandler<M[K]>)(payload, meta);
        } catch (err) {
          reportHandlerError(err);
        }
      }
    }
    for (const handler of [...this.anyHandlers]) {
      try {
        handler(event);
      } catch (err) {
        reportHandlerError(err);
      }
    }
  }

  /** Remove all handlers and middleware (used on teardown / between tests). */
  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
    this.middlewares = [];
  }
}

function reportHandlerError(err: unknown): void {
  if (typeof console !== "undefined") {
    console.error("[pdf-editor] event handler threw:", err);
  }
}
