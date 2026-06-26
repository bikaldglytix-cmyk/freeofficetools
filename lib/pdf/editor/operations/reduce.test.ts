import { describe, expect, it } from "vitest";
import { firstPageId, makeDoc, makeText, rect } from "../test-utils";
import { createImageObject, createOCRLayer, createPage } from "../model/factory";
import { applyPatch, revertPatch } from "../patch/apply";
import type { ImageObject, TextBlock } from "../model/types";
import { ops } from "./types";
import { reduceOperation } from "./reduce";

describe("reduceOperation", () => {
  it("ADD_TEXT → obj.add, reversible", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const obj = makeText(p0, "A");
    const patch = reduceOperation(doc, ops.addText(p0, obj));
    expect(patch.changes).toEqual([{ t: "obj.add", pageId: p0, object: obj }]);

    const next = applyPatch(doc, patch);
    expect(next.objectsByPage[p0][obj.id]).toBe(obj);
    const back = revertPatch(next, patch);
    expect(back.objectOrder[p0]).toEqual([]);
  });

  it("UPDATE_TEXT captures before-state from the live document", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const obj = makeText(p0, "A", { fontSize: 12 });
    const seeded = applyPatch(doc, reduceOperation(doc, ops.addText(p0, obj)));

    const patch = reduceOperation(seeded, ops.updateText(p0, obj.id, { fontSize: 24 }));
    const change = patch.changes[0] as Extract<typeof patch.changes[number], { t: "obj.update" }>;
    expect((change.before as Partial<TextBlock>).fontSize).toBe(12);
    expect((change.after as Partial<TextBlock>).fontSize).toBe(24);

    const updated = applyPatch(seeded, patch);
    expect((updated.objectsByPage[p0][obj.id] as TextBlock).fontSize).toBe(24);
    const reverted = revertPatch(updated, patch);
    expect((reverted.objectsByPage[p0][obj.id] as TextBlock).fontSize).toBe(12);
  });

  it("MOVE_IMAGE updates rect reversibly", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const img: ImageObject = createImageObject({
      pageId: p0,
      rect: rect(0, 0, 50, 50),
      src: "data:,",
      mimeType: "image/png",
      naturalWidth: 50,
      naturalHeight: 50,
    });
    const seeded = applyPatch(doc, reduceOperation(doc, ops.addImage(p0, img)));
    const moved = applyPatch(seeded, reduceOperation(seeded, ops.moveImage(p0, img.id, rect(100, 100, 50, 50))));
    expect((moved.objectsByPage[p0][img.id] as ImageObject).rect.x).toBe(100);
  });

  it("DELETE_TEXT captures the full object for restore", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const obj = makeText(p0, "bye");
    const seeded = applyPatch(doc, reduceOperation(doc, ops.addText(p0, obj)));

    const patch = reduceOperation(seeded, ops.deleteText(p0, obj.id));
    expect(patch.changes[0]).toEqual({ t: "obj.remove", pageId: p0, object: obj });

    const deleted = applyPatch(seeded, patch);
    expect(deleted.objectsByPage[p0][obj.id]).toBeUndefined();
    const restored = revertPatch(deleted, patch);
    expect(restored.objectsByPage[p0][obj.id]).toEqual(obj);
  });

  it("INSERT_PAGE / DELETE_PAGE / MOVE_PAGE", () => {
    const doc = makeDoc(2);
    const page = createPage({ size: { width: 100, height: 100 } });

    const inserted = applyPatch(doc, reduceOperation(doc, ops.insertPage(page, 1)));
    expect(inserted.pageOrder[1]).toBe(page.id);

    const delPatch = reduceOperation(inserted, ops.deletePage(page.id));
    const delChange = delPatch.changes[0] as Extract<typeof delPatch.changes[number], { t: "page.remove" }>;
    expect(delChange.index).toBe(1);

    const moved = applyPatch(doc, reduceOperation(doc, ops.movePage(doc.pageOrder[0], 1)));
    expect(moved.pageOrder[1]).toBe(doc.pageOrder[0]);
  });

  it("OCR_APPLY sets the layer reversibly", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const layer = createOCRLayer({ pageId: p0, words: [] });
    const patch = reduceOperation(doc, ops.ocrApply(p0, layer));
    const next = applyPatch(doc, patch);
    expect(next.ocrLayers[p0]).toBe(layer);
    const back = revertPatch(next, patch);
    expect(back.ocrLayers[p0]).toBeUndefined();
  });

  it("BATCH produces a single patch covering all children", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const a = makeText(p0, "a");
    const b = makeText(p0, "b");
    const patch = reduceOperation(doc, ops.batch([ops.addText(p0, a), ops.addText(p0, b)]));
    expect(patch.changes).toHaveLength(2);
    const next = applyPatch(doc, patch);
    expect(next.objectOrder[p0]).toHaveLength(2);
    const back = revertPatch(next, patch);
    expect(back.objectOrder[p0]).toHaveLength(0);
  });

  it("returns an empty patch for a no-op (updating a missing object)", () => {
    const doc = makeDoc(1);
    const p0 = firstPageId(doc);
    const patch = reduceOperation(doc, ops.updateText(p0, "obj_missing", { text: "x" }));
    expect(patch.changes).toHaveLength(0);
  });
});
