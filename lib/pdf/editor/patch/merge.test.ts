import { describe, expect, it } from "vitest";
import { newPatchId } from "../model/ids";
import { coalesceUpdates, isEmptyPatch, mergePatches } from "./merge";
import type { Change, Patch } from "./types";

function patch(changes: Change[]): Patch {
  return { id: newPatchId(), schemaVersion: 1, timestamp: 1, changes };
}

describe("coalesceUpdates", () => {
  it("collapses consecutive updates to the same object", () => {
    const changes: Change[] = [
      { t: "obj.update", pageId: "p", id: "o", before: { rect: a(0) }, after: { rect: a(1) } },
      { t: "obj.update", pageId: "p", id: "o", before: { rect: a(1) }, after: { rect: a(2) } },
      { t: "obj.update", pageId: "p", id: "o", before: { rect: a(2) }, after: { rect: a(3) } },
    ];
    const out = coalesceUpdates(changes);
    expect(out).toHaveLength(1);
    const u = out[0] as Extract<Change, { t: "obj.update" }>;
    // Keeps the earliest before and the latest after — one clean undo step.
    expect(u.before.rect).toEqual(a(0));
    expect(u.after.rect).toEqual(a(3));
  });

  it("does not coalesce across a remove of the same object", () => {
    const obj = { id: "o", pageId: "p", kind: "text" } as never;
    const changes: Change[] = [
      { t: "obj.update", pageId: "p", id: "o", before: {}, after: { opacity: 0.5 } },
      { t: "obj.remove", pageId: "p", object: obj },
      { t: "obj.update", pageId: "p", id: "o", before: {}, after: { opacity: 0.9 } },
    ];
    expect(coalesceUpdates(changes)).toHaveLength(3);
  });

  it("keeps updates to different objects separate", () => {
    const changes: Change[] = [
      { t: "obj.update", pageId: "p", id: "a", before: {}, after: { opacity: 0.1 } },
      { t: "obj.update", pageId: "p", id: "b", before: {}, after: { opacity: 0.2 } },
    ];
    expect(coalesceUpdates(changes)).toHaveLength(2);
  });
});

describe("mergePatches", () => {
  it("concatenates and coalesces into one patch", () => {
    const merged = mergePatches([
      patch([{ t: "obj.update", pageId: "p", id: "o", before: { opacity: 1 }, after: { opacity: 0.5 } }]),
      patch([{ t: "obj.update", pageId: "p", id: "o", before: { opacity: 0.5 }, after: { opacity: 0.2 } }]),
    ]);
    expect(merged.changes).toHaveLength(1);
    expect(isEmptyPatch(merged)).toBe(false);
  });
});

describe("isEmptyPatch", () => {
  it("detects no-op patches", () => {
    expect(isEmptyPatch(patch([]))).toBe(true);
  });
});

function a(n: number) {
  return { x: n, y: n, width: 1, height: 1 };
}
