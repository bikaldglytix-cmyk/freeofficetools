import { describe, expect, it } from "vitest";
import { reflowBelowOps } from "./reflow";
import { createTextBlock } from "./factory";
import type { EditableObject, Rect, TextBlock } from "./types";

const block = (id: string, y: number, height = 20, over: Partial<TextBlock> = {}): EditableObject => ({
  ...createTextBlock({ pageId: "p1", rect: { x: 10, y, width: 100, height }, text: id }),
  id,
  ...over,
});

function movedY(ops: ReturnType<typeof reflowBelowOps>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const op of ops) {
    if ("rect" in op && op.rect) out[op.id] = (op.rect as Rect).y;
    else if ("changes" in op && op.changes && "rect" in op.changes && op.changes.rect) out[op.id] = (op.changes.rect as Rect).y;
  }
  return out;
}

describe("reflowBelowOps", () => {
  const anchor = block("anchor", 100, 30); // bottom = 130
  const objects: EditableObject[] = [
    anchor,
    block("above", 50), // above the anchor's old bottom — must NOT move
    block("below1", 130), // exactly at old bottom — moves
    block("below2", 200), // well below — moves
  ];

  it("pushes objects at/below the old bottom down by the growth delta", () => {
    const ops = reflowBelowOps({ pageId: "p1", objects, anchorId: "anchor", oldBottom: 130, delta: 25 });
    const ys = movedY(ops);
    expect(ys.below1).toBe(155);
    expect(ys.below2).toBe(225);
    expect(ys.above).toBeUndefined(); // untouched
    expect(ys.anchor).toBeUndefined(); // the grown block never moves itself
  });

  it("does nothing when the block shrank or barely changed", () => {
    expect(reflowBelowOps({ pageId: "p1", objects, anchorId: "anchor", oldBottom: 130, delta: 0 })).toHaveLength(0);
    expect(reflowBelowOps({ pageId: "p1", objects, anchorId: "anchor", oldBottom: 130, delta: -10 })).toHaveLength(0);
  });

  it("leaves locked objects in place", () => {
    const withLock = objects.map((o) => (o.id === "below1" ? { ...o, locked: true } : o));
    const ys = movedY(reflowBelowOps({ pageId: "p1", objects: withLock, anchorId: "anchor", oldBottom: 130, delta: 25 }));
    expect(ys.below1).toBeUndefined();
    expect(ys.below2).toBe(225);
  });
});
