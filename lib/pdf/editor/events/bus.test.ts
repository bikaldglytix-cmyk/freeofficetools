import { describe, expect, it, vi } from "vitest";
import { TypedEventBus } from "./bus";

// A `type` (not `interface`) so it satisfies the `Record<string, unknown>`
// constraint via its implicit index signature.
type Events = {
  ping: { n: number };
  pong: { ok: boolean };
};

describe("TypedEventBus", () => {
  it("delivers payloads to subscribers", () => {
    const bus = new TypedEventBus<Events>();
    const spy = vi.fn();
    bus.on("ping", spy);
    bus.emit("ping", { n: 1 });
    expect(spy).toHaveBeenCalledWith({ n: 1 }, expect.objectContaining({ type: "ping" }));
  });

  it("off / returned unsubscribe stops delivery", () => {
    const bus = new TypedEventBus<Events>();
    const spy = vi.fn();
    const off = bus.on("ping", spy);
    off();
    bus.emit("ping", { n: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("once fires a single time", () => {
    const bus = new TypedEventBus<Events>();
    const spy = vi.fn();
    bus.once("ping", spy);
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("onAny receives every event", () => {
    const bus = new TypedEventBus<Events>();
    const spy = vi.fn();
    bus.onAny(spy);
    bus.emit("ping", { n: 1 });
    bus.emit("pong", { ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0]).toMatchObject({ type: "pong", payload: { ok: true } });
  });

  it("middleware runs in order and can short-circuit", () => {
    const bus = new TypedEventBus<Events>();
    const order: string[] = [];
    bus.use((_e, next) => {
      order.push("a");
      next();
    });
    bus.use((e, next) => {
      order.push("b");
      if ((e.payload as { n: number }).n === 0) return; // drop
      next();
    });
    const handler = vi.fn(() => order.push("handler"));
    bus.on("ping", handler);

    bus.emit("ping", { n: 1 });
    expect(order).toEqual(["a", "b", "handler"]);
    expect(handler).toHaveBeenCalledTimes(1);

    order.length = 0;
    bus.emit("ping", { n: 0 });
    expect(order).toEqual(["a", "b"]); // handler never reached
  });

  it("isolates subscriber errors", () => {
    const bus = new TypedEventBus<Events>();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const good = vi.fn();
    bus.on("ping", () => {
      throw new Error("boom");
    });
    bus.on("ping", good);
    bus.emit("ping", { n: 1 });
    expect(good).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("clear removes handlers and middleware", () => {
    const bus = new TypedEventBus<Events>();
    const spy = vi.fn();
    bus.on("ping", spy);
    bus.clear();
    bus.emit("ping", { n: 1 });
    expect(spy).not.toHaveBeenCalled();
  });
});
