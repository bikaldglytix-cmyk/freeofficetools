import { describe, expect, it, vi } from "vitest";
import { firstPageId, makeDoc, makeText, rect } from "../test-utils";
import { ops } from "../operations/types";
import { selectPageObjects } from "./selectors";
import { createDocumentStore } from "./document-store";

function setup(pageCount = 1) {
  const store = createDocumentStore();
  const doc = makeDoc(pageCount);
  store.getState().loadDocument(doc);
  return { store, doc, p0: firstPageId(doc) };
}

describe("document store — dispatch", () => {
  it("applies an operation and marks the document dirty", () => {
    const { store, p0 } = setup();
    const obj = makeText(p0, "hi");
    const patch = store.getState().dispatch(ops.addText(p0, obj));
    expect(patch).not.toBeNull();
    const s = store.getState();
    expect(s.dirty).toBe(true);
    expect(selectPageObjects(s.document!, p0)).toHaveLength(1);
  });

  it("ignores no-op operations (no history entry)", () => {
    const { store, p0 } = setup();
    const before = store.getState().history.undo.length;
    const result = store.getState().dispatch(ops.updateText(p0, "obj_missing", { text: "x" }));
    expect(result).toBeNull();
    expect(store.getState().history.undo.length).toBe(before);
  });
});

describe("document store — undo/redo", () => {
  it("undo reverts and redo re-applies", () => {
    const { store, p0 } = setup();
    const obj = makeText(p0, "hi");
    store.getState().dispatch(ops.addText(p0, obj));
    expect(store.getState().history.undo).toHaveLength(1);

    expect(store.getState().undo()).toBe(true);
    expect(selectPageObjects(store.getState().document!, p0)).toHaveLength(0);
    expect(store.getState().history.redo).toHaveLength(1);

    expect(store.getState().redo()).toBe(true);
    expect(selectPageObjects(store.getState().document!, p0)).toHaveLength(1);
  });

  it("a new dispatch clears the redo stack", () => {
    const { store, p0 } = setup();
    store.getState().dispatch(ops.addText(p0, makeText(p0, "a")));
    store.getState().undo();
    expect(store.getState().history.redo).toHaveLength(1);
    store.getState().dispatch(ops.addText(p0, makeText(p0, "b")));
    expect(store.getState().history.redo).toHaveLength(0);
  });

  it("undo on empty history is a safe no-op", () => {
    const { store } = setup();
    expect(store.getState().undo()).toBe(false);
  });

  it("dispatchAll collapses many ops into one undo step", () => {
    const { store, p0 } = setup();
    store.getState().dispatchAll([
      ops.addText(p0, makeText(p0, "a")),
      ops.addText(p0, makeText(p0, "b")),
      ops.addText(p0, makeText(p0, "c")),
    ]);
    expect(selectPageObjects(store.getState().document!, p0)).toHaveLength(3);
    expect(store.getState().history.undo).toHaveLength(1);
    store.getState().undo();
    expect(selectPageObjects(store.getState().document!, p0)).toHaveLength(0);
  });
});

describe("document store — transactions", () => {
  it("commit records a single merged undo entry", () => {
    const { store, p0 } = setup();
    const obj = makeText(p0, "drag", { zIndex: 0 });
    store.getState().dispatch(ops.addText(p0, obj));
    expect(store.getState().history.undo).toHaveLength(1);

    store.getState().beginTransaction("drag");
    store.getState().dispatch(ops.moveText(p0, obj.id, rect(20, 20)));
    store.getState().dispatch(ops.moveText(p0, obj.id, rect(40, 40)));
    // Live document already reflects the drag, but no new undo entries yet.
    expect(store.getState().history.undo).toHaveLength(1);
    store.getState().commitTransaction();
    expect(store.getState().history.undo).toHaveLength(2);

    store.getState().undo(); // one undo reverts the whole drag
    const obj2 = store.getState().document!.objectsByPage[p0][obj.id];
    expect(obj2.rect.x).toBe(10);
  });

  it("cancel reverts everything dispatched in the transaction", () => {
    const { store, p0 } = setup();
    const obj = makeText(p0, "x");
    store.getState().dispatch(ops.addText(p0, obj));
    store.getState().beginTransaction();
    store.getState().dispatch(ops.moveText(p0, obj.id, rect(99, 99)));
    store.getState().cancelTransaction();
    expect(store.getState().document!.objectsByPage[p0][obj.id].rect.x).toBe(10);
    expect(store.getState().transaction).toBeNull();
  });
});

describe("document store — selection & lifecycle", () => {
  it("tracks selection and active page", () => {
    const { store, p0 } = setup();
    store.getState().select(p0, ["a", "b"]);
    expect(store.getState().selection).toEqual({ pageId: p0, ids: ["a", "b"] });
    expect(store.getState().activePageId).toBe(p0);
    store.getState().toggleSelect(p0, "a");
    expect(store.getState().selection.ids).toEqual(["b"]);
    store.getState().clearSelection();
    expect(store.getState().selection.ids).toEqual([]);
  });

  it("loadDocument resets history/selection; markSaved clears dirty", () => {
    const { store, p0 } = setup();
    store.getState().dispatch(ops.addText(p0, makeText(p0)));
    store.getState().markSaved(123);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().lastSavedAt).toBe(123);

    store.getState().loadDocument(makeDoc(1));
    expect(store.getState().history.undo).toHaveLength(0);
    expect(store.getState().dirty).toBe(false);
  });
});

describe("document store — events", () => {
  it("emits operation, document and granular events on dispatch", () => {
    const { store, p0 } = setup();
    const events = store.getState().events;
    const opSpy = vi.fn();
    const docSpy = vi.fn();
    const addSpy = vi.fn();
    events.on("OPERATION_DISPATCHED", opSpy);
    events.on("DOCUMENT_CHANGED", docSpy);
    events.on("OBJECT_ADDED", addSpy);

    store.getState().dispatch(ops.addText(p0, makeText(p0)));

    expect(opSpy).toHaveBeenCalledTimes(1);
    expect(docSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls[0][0]).toMatchObject({ pageId: p0, kind: "text" });
  });

  it("emits HISTORY_CHANGED with accurate sizes", () => {
    const { store, p0 } = setup();
    const spy = vi.fn();
    store.getState().events.on("HISTORY_CHANGED", spy);
    store.getState().dispatch(ops.addText(p0, makeText(p0)));
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ canUndo: true, undoSize: 1, redoSize: 0 }),
      expect.anything(),
    );
  });
});
