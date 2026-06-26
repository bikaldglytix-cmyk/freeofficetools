import { describe, expect, it } from "vitest";
import { createMemoryBackend } from "@/lib/pdf/editor/persistence/backend";
import { DraftStore } from "@/lib/pdf/editor/persistence/draft-store";
import { createDocument, createPage } from "@/lib/pdf/editor/model/factory";
import { createDocumentStore } from "@/lib/pdf/editor/store/document-store";
import { ops } from "@/lib/pdf/editor/operations/types";
import {
  addAnnotationOperation,
  annotationsInRect,
  annotationToEditorObject,
  createDrawingAnnotation,
  createHighlightAnnotation,
  createShapeAnnotation,
  createSignatureAnnotation,
  editorObjectToAnnotation,
  hitTestAnnotation,
  rectToQuad,
  simplifyPath,
} from "./index";

function testDocument() {
  return createDocument({
    id: "doc_test",
    fileName: "test.pdf",
    pages: [createPage({ id: "page_1", sourcePageIndex: 0, size: { width: 612, height: 792 } })],
  });
}

describe("annotation model and adapters", () => {
  it("creates rich highlight annotations and stores export metadata", () => {
    const highlight = createHighlightAnnotation(
      { documentId: "doc_test", pageId: "page_1", author: "Ada", now: 100 },
      [rectToQuad({ x: 10, y: 20, width: 80, height: 14 })],
      "selected text",
    );

    expect(highlight.type).toBe("highlight");
    expect(highlight.bounds).toEqual({ x: 10, y: 20, width: 80, height: 14 });
    expect(highlight.export.pdfSubtype).toBe("Highlight");
    expect(highlight.author).toBe("Ada");
  });

  it("round-trips rich annotations through editor objects", () => {
    const stamp = createShapeAnnotation(
      { documentId: "doc_test", pageId: "page_1", author: "Ada", now: 100 },
      "rectangle",
      { x: 12, y: 24, width: 120, height: 60 },
    );
    const object = annotationToEditorObject(stamp);
    const restored = editorObjectToAnnotation(object, "doc_test");

    expect(object.kind).toBe("annotation");
    expect(restored.id).toBe(stamp.id);
    expect(restored.bounds).toEqual(stamp.bounds);
  });
});

describe("annotation selection", () => {
  it("hit-tests the highest z-index visible annotation", () => {
    const low = annotationToEditorObject(
      createShapeAnnotation({ documentId: "doc_test", pageId: "page_1", now: 100, zIndex: 1 }, "rectangle", {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }),
    );
    const high = annotationToEditorObject(
      createShapeAnnotation({ documentId: "doc_test", pageId: "page_1", now: 100, zIndex: 5 }, "rectangle", {
        x: 20,
        y: 20,
        width: 100,
        height: 100,
      }),
    );

    expect(hitTestAnnotation([low, high], { x: 30, y: 30 })?.id).toBe(high.id);
    expect(annotationsInRect([low, high], { x: 0, y: 0, width: 40, height: 40 })).toEqual([low.id, high.id]);
  });
});

describe("annotation operations", () => {
  it("adds, updates, deletes, undoes and redoes annotations through the Phase 2 store", () => {
    const store = createDocumentStore();
    store.getState().loadDocument(testDocument());
    const annotation = createShapeAnnotation(
      { documentId: "doc_test", pageId: "page_1", now: 100 },
      "rectangle",
      { x: 10, y: 10, width: 50, height: 40 },
    );
    const object = annotationToEditorObject(annotation);

    store.getState().dispatch(addAnnotationOperation(annotation));
    expect(store.getState().document?.objectsByPage.page_1[object.id]).toBeDefined();

    store.getState().dispatch(ops.updateAnnotation("page_1", object.id, { rect: { x: 20, y: 25, width: 50, height: 40 } }));
    expect(store.getState().document?.objectsByPage.page_1[object.id]?.rect.x).toBe(20);

    store.getState().dispatch(ops.deleteAnnotation("page_1", object.id));
    expect(store.getState().document?.objectsByPage.page_1[object.id]).toBeUndefined();

    expect(store.getState().undo()).toBe(true);
    expect(store.getState().document?.objectsByPage.page_1[object.id]).toBeDefined();
    expect(store.getState().redo()).toBe(true);
    expect(store.getState().document?.objectsByPage.page_1[object.id]).toBeUndefined();
  });

  it("updates signatures as reversible operations", () => {
    const store = createDocumentStore();
    store.getState().loadDocument(testDocument());
    const signature = annotationToEditorObject(
      createSignatureAnnotation(
        { documentId: "doc_test", pageId: "page_1", now: 100 },
        { x: 20, y: 20, width: 120, height: 40 },
        { mode: "typed", text: "Ada" },
      ),
    );

    expect(signature.kind).toBe("signature");
    if (signature.kind !== "signature") throw new Error("Expected a signature object");
    store.getState().dispatch(ops.addSignature("page_1", signature));
    store.getState().dispatch(ops.updateSignature("page_1", signature.id, { rect: { x: 40, y: 50, width: 160, height: 48 } }));

    expect(store.getState().document?.objectsByPage.page_1[signature.id]?.rect.x).toBe(40);
    store.getState().undo();
    expect(store.getState().document?.objectsByPage.page_1[signature.id]?.rect.x).toBe(20);
  });
});

describe("drawing and persistence", () => {
  it("simplifies vector drawing paths without rasterizing them", () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i % 2 === 0 ? i : i + 0.2 }));
    const simplified = simplifyPath(points, 1);
    const drawing = createDrawingAnnotation({ documentId: "doc_test", pageId: "page_1", now: 100 }, [simplified]);

    expect(drawing.type).toBe("drawing");
    if (drawing.type !== "drawing") throw new Error("Expected drawing annotation");
    expect(drawing.paths[0].length).toBeLessThan(points.length);
  });

  it("persists annotations inside document drafts", async () => {
    const document = testDocument();
    const annotation = annotationToEditorObject(
      createShapeAnnotation({ documentId: document.meta.id, pageId: "page_1", now: 100 }, "circle", {
        x: 10,
        y: 10,
        width: 30,
        height: 30,
      }),
    );
    document.objectsByPage.page_1[annotation.id] = annotation;
    document.objectOrder.page_1.push(annotation.id);

    const drafts = new DraftStore(createMemoryBackend());
    await drafts.saveDraft(document, { savedAt: 123 });
    const loaded = await drafts.loadDraft(document.meta.id);

    expect(loaded?.savedAt).toBe(123);
    expect(loaded?.document.objectsByPage.page_1[annotation.id]).toEqual(annotation);
  });
});
