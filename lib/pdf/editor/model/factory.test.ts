import { describe, expect, it } from "vitest";
import {
  createAnnotation,
  createDocument,
  createImageObject,
  createPage,
  createRevision,
  createTextBlock,
  SCHEMA_VERSION,
} from "./factory";

const rect = { x: 0, y: 0, width: 10, height: 10 };

describe("model factories", () => {
  it("builds a text block with ids, timestamps and defaults", () => {
    const t = createTextBlock({ pageId: "pg_1", rect, text: "hi" });
    expect(t.kind).toBe("text");
    expect(t.id).toMatch(/^obj_/);
    expect(t.pageId).toBe("pg_1");
    expect(t.text).toBe("hi");
    expect(t.fontFamily).toBe("Helvetica");
    expect(t.fontSize).toBe(12);
    expect(t.source).toBe("added");
    expect(t.createdAt).toBeGreaterThan(0);
    expect(t.updatedAt).toBe(t.createdAt);
    expect(t.transform).toEqual([1, 0, 0, 1, 0, 0]);
    expect(t.metadata).toEqual({});
  });

  it("honours explicit base overrides", () => {
    const img = createImageObject({
      pageId: "pg_1",
      rect,
      src: "data:image/png;base64,xxx",
      mimeType: "image/png",
      naturalWidth: 4,
      naturalHeight: 4,
      zIndex: 5,
      opacity: 0.5,
      locked: true,
    });
    expect(img.zIndex).toBe(5);
    expect(img.opacity).toBe(0.5);
    expect(img.locked).toBe(true);
  });

  it("annotation defaults to a highlight colour", () => {
    const a = createAnnotation({ pageId: "pg_1", rect, annotationType: "highlight" });
    expect(a.color).toBe("#ffd400");
    expect(a.annotationType).toBe("highlight");
  });

  it("builds a normalized, empty document with per-page maps", () => {
    const page = createPage({ size: { width: 100, height: 200 } });
    const doc = createDocument({ pages: [page], fileName: "f.pdf" });
    expect(doc.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.pageOrder).toEqual([page.id]);
    expect(doc.objectsByPage[page.id]).toEqual({});
    expect(doc.objectOrder[page.id]).toEqual([]);
    expect(doc.ocrLayers[page.id]).toBeUndefined();
  });

  it("wraps a snapshot into a revision", () => {
    const doc = createDocument({ fileName: "f.pdf" });
    const rev = createRevision({ label: "v1", snapshot: doc });
    expect(rev.id).toMatch(/^rev_/);
    expect(rev.label).toBe("v1");
    expect(rev.snapshot).toBe(doc);
    expect(rev.schemaVersion).toBe(doc.meta.schemaVersion);
  });
});
