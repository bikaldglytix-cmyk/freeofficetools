import { describe, expect, it } from "vitest";
import { firstPageId, makeDoc, makeText } from "../test-utils";
import { newPatchId } from "../model/ids";
import { applyPatch, invertPatch, revertPatch } from "./apply";
import type { Patch } from "./types";

function patch(changes: Patch["changes"]): Patch {
  return { id: newPatchId(), schemaVersion: 1, timestamp: 1000, changes };
}

describe("applyPatch", () => {
  it("adds an object and keeps it in z-order", () => {
    const doc = makeDoc(2);
    const pageId = firstPageId(doc);
    const obj = makeText(pageId, "A", { zIndex: 1 });
    const next = applyPatch(doc, patch([{ t: "obj.add", pageId, object: obj }]));

    expect(next.objectOrder[pageId]).toEqual([obj.id]);
    expect(next.objectsByPage[pageId][obj.id]).toBe(obj);
  });

  it("structurally shares untouched pages (memoization-friendly)", () => {
    const doc = makeDoc(2);
    const [p0, p1] = doc.pageOrder;
    const obj = makeText(p0, "A");
    const next = applyPatch(doc, patch([{ t: "obj.add", pageId: p0, object: obj }]));

    // Touched page gets fresh references…
    expect(next.objectsByPage[p0]).not.toBe(doc.objectsByPage[p0]);
    expect(next.objectOrder[p0]).not.toBe(doc.objectOrder[p0]);
    // …but the other page keeps its exact references.
    expect(next.objectsByPage[p1]).toBe(doc.objectsByPage[p1]);
    expect(next.objectOrder[p1]).toBe(doc.objectOrder[p1]);
  });

  it("does not mutate the input document (immutability)", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    applyPatch(doc, patch([{ t: "obj.add", pageId: p0, object: makeText(p0) }]));
    expect(doc.objectOrder[p0]).toEqual([]);
  });

  it("sorts by zIndex then creation order", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const low = makeText(p0, "low", { zIndex: 0 });
    const high = makeText(p0, "high", { zIndex: 10 });
    const mid = makeText(p0, "mid", { zIndex: 5 });
    const next = applyPatch(
      doc,
      patch([
        { t: "obj.add", pageId: p0, object: high },
        { t: "obj.add", pageId: p0, object: low },
        { t: "obj.add", pageId: p0, object: mid },
      ]),
    );
    expect(next.objectOrder[p0]).toEqual([low.id, mid.id, high.id]);
  });

  it("inverts add/remove and update round-trips losslessly", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const obj = makeText(p0, "A");

    const addPatch = patch([{ t: "obj.add", pageId: p0, object: obj }]);
    const added = applyPatch(doc, addPatch);
    const removed = revertPatch(added, addPatch);
    expect(removed.objectsByPage[p0]).toEqual(doc.objectsByPage[p0]);
    expect(removed.objectOrder[p0]).toEqual(doc.objectOrder[p0]);

    const updatePatch = patch([
      {
        t: "obj.update",
        pageId: p0,
        id: obj.id,
        before: { text: "A" },
        after: { text: "B" },
      },
    ]);
    const updated = applyPatch(added, updatePatch);
    expect((updated.objectsByPage[p0][obj.id] as { text: string }).text).toBe("B");
    const reverted = revertPatch(updated, updatePatch);
    expect((reverted.objectsByPage[p0][obj.id] as { text: string }).text).toBe("A");
  });

  it("inverts page insert/remove", () => {
    const doc = makeDoc(1);
    const newPage = { ...doc.pages[doc.pageOrder[0]], id: "pg_new" };
    const insert = patch([
      { t: "page.insert", index: 1, page: newPage, objects: [], ocr: null },
    ]);
    const withPage = applyPatch(doc, insert);
    expect(withPage.pageOrder).toContain("pg_new");
    const back = revertPatch(withPage, insert);
    expect(back.pageOrder).not.toContain("pg_new");
    expect(back.pages["pg_new"]).toBeUndefined();
  });

  it("invertPatch reverses order so dependent changes unwind correctly", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const obj = makeText(p0, "A");
    const p = patch([
      { t: "obj.add", pageId: p0, object: obj },
      { t: "obj.update", pageId: p0, id: obj.id, before: { text: "A" }, after: { text: "B" } },
    ]);
    const inv = invertPatch(p);
    // First inverted change must undo the *last* original change.
    expect(inv.changes[0].t).toBe("obj.update");
    expect(inv.changes[1].t).toBe("obj.remove");
  });
});
