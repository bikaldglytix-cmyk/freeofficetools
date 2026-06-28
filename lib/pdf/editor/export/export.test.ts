/**
 * Export Engine tests (Phase 5 §16). Runs in Node (vitest), exercising the pure,
 * framework-free engine end to end with real pdf-lib I/O — no DOM, no network.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  createAnnotation,
  createDocument,
  createImageObject,
  createOCRLayer,
  createPage,
  createRedaction,
  createSignature,
  createTextBlock,
} from "../model/factory";
import type { DocumentState, PageId, Rect } from "../model/types";
import { parseColor } from "./color";
import { mapPoint, placeBox, placementFor } from "./geometry";
import { whiteoutRects } from "./overlay-renderer";
import { ExportPipeline } from "./pipeline";
import { ValidationService } from "./validation";

// 1x1 transparent PNG.
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function makeSourcePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`source page ${i + 1}`, { x: 72, y: 700, size: 18 });
  }
  doc.setTitle("Source Title");
  doc.setAuthor("Source Author");
  return doc.save();
}

function makeDoc(pageCount = 2): DocumentState {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    createPage({ size: { width: 612, height: 792 }, sourcePageIndex: i }),
  );
  return createDocument({ fileName: "edited.pdf", title: "Edited Doc", pages });
}

function addObject(doc: DocumentState, pageId: PageId, obj: { id: string; zIndex: number }): void {
  doc.objectsByPage[pageId][obj.id] = obj as never;
  doc.objectOrder[pageId].push(obj.id);
}

async function reload(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

// ---------------------------------------------------------------------------

describe("geometry", () => {
  it("maps the four page rotations correctly", () => {
    const r0 = placementFor({ width: 612, height: 792 }, 0);
    expect(mapPoint(10, 20, r0)).toEqual({ x: 10, y: 772 });

    const r90 = placementFor({ width: 792, height: 612 }, 90);
    expect(r90.mediaWidth).toBe(612);
    expect(r90.mediaHeight).toBe(792);
    expect(mapPoint(10, 20, r90)).toEqual({ x: 20, y: 10 });

    const r180 = placementFor({ width: 612, height: 792 }, 180);
    expect(mapPoint(10, 20, r180)).toEqual({ x: 602, y: 20 });

    const r270 = placementFor({ width: 792, height: 612 }, 270);
    expect(mapPoint(10, 20, r270)).toEqual({ x: 592, y: 782 });
  });

  it("places an unrotated box at the right pdf anchor", () => {
    const p = placementFor({ width: 612, height: 792 }, 0);
    const rect: Rect = { x: 100, y: 50, width: 200, height: 30 };
    const placed = placeBox(rect, p, 0);
    expect(placed.x).toBeCloseTo(100);
    expect(placed.y).toBeCloseTo(712); // 792 - (50 + 30)
    expect(placed.width).toBe(200);
    expect(placed.height).toBe(30);
    expect(placed.rotateDeg).toBe(0);
  });
});

describe("color", () => {
  it("parses hex, short hex, alpha, rgb(), and names", () => {
    expect(parseColor("#ff0000").rgb).toMatchObject({ red: 1, green: 0, blue: 0 });
    expect(parseColor("#0f0").rgb).toMatchObject({ red: 0, green: 1, blue: 0 });
    expect(parseColor("#00000080").alpha).toBeCloseTo(0.5, 1);
    expect(parseColor("rgb(255,0,0)").rgb).toMatchObject({ red: 1, green: 0, blue: 0 });
    expect(parseColor("rgba(0,0,0,0.5)").alpha).toBeCloseTo(0.5);
    expect(parseColor("white").rgb).toMatchObject({ red: 1, green: 1, blue: 1 });
  });

  it("falls back to black on garbage", () => {
    expect(parseColor("not-a-color").rgb).toMatchObject({ red: 0, green: 0, blue: 0 });
  });
});

describe("overlay — whiteout bounds", () => {
  const block = (metadata: Record<string, unknown>) =>
    ({ rect: { x: 10, y: 10, width: 100, height: 20 }, metadata }) as never;

  it("masks the ORIGINAL glyph bounds from export.whiteout.bounds, not the live rect", () => {
    // This is the shape the text engine actually produces (createWhiteoutRestampInstruction).
    const original = { x: 5, y: 5, width: 80, height: 12 };
    const rects = whiteoutRects(block({ export: { whiteout: { bounds: [original] } } }));
    expect(rects).toHaveLength(1);
    // Padded original bounds — must derive from `original`, not the block rect.
    expect(rects[0].x).toBeCloseTo(original.x - 1.25, 2);
    expect(rects[0].width).toBeCloseTo(original.width + 2.5, 2);
  });

  it("still honours the legacy metadata.whiteoutBounds key", () => {
    const rects = whiteoutRects(block({ whiteoutBounds: [{ x: 1, y: 2, width: 3, height: 4 }] }));
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBeCloseTo(1 - 1.25, 2);
  });

  it("falls back to the block rect when no bounds are recorded", () => {
    const rects = whiteoutRects(block({}));
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeCloseTo(100 + 2.5, 2);
  });
});

describe("validation", () => {
  const v = new ValidationService();

  it("flags a missing page in the range as fatal", () => {
    const doc = makeDoc(1);
    const report = v.validate(doc, ["does-not-exist"]);
    expect(report.ok).toBe(false);
    expect(report.diagnostics.some((d) => d.code === "MISSING_PAGE")).toBe(true);
  });

  it("skips invalid geometry, off-page, and missing-resource objects", () => {
    const doc = makeDoc(1);
    const pageId = doc.pageOrder[0];
    const bad = createTextBlock({ pageId, rect: { x: 0, y: 0, width: 0, height: 10 }, text: "x" });
    const off = createTextBlock({ pageId, rect: { x: 9000, y: 0, width: 50, height: 10 }, text: "x" });
    const noImg = createImageObject({ pageId, rect: { x: 0, y: 0, width: 10, height: 10 }, src: "", mimeType: "image/png", naturalWidth: 1, naturalHeight: 1 });
    addObject(doc, pageId, bad);
    addObject(doc, pageId, off);
    addObject(doc, pageId, noImg);

    const report = v.validate(doc, null);
    expect(report.ok).toBe(true);
    expect(report.skip.has(bad.id)).toBe(true);
    expect(report.skip.has(off.id)).toBe(true);
    expect(report.skip.has(noImg.id)).toBe(true);
    expect(report.diagnostics.some((d) => d.code === "INVALID_GEOMETRY")).toBe(true);
    expect(report.diagnostics.some((d) => d.code === "OFFPAGE_OBJECT")).toBe(true);
    expect(report.diagnostics.some((d) => d.code === "MISSING_RESOURCE")).toBe(true);
  });
});

describe("pipeline — end to end", () => {
  const pipeline = new ExportPipeline();

  it("copies source pages and produces a valid PDF", async () => {
    const source = await makeSourcePdf(2);
    const doc = makeDoc(2);
    const result = await pipeline.run({ document: doc, source });

    expect(result.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(result.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(result.pageCount).toBe(2);
    const reloaded = await reload(result.bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("renders overlay objects on blank pages and warns when no source is given", async () => {
    const doc = makeDoc(1);
    const pageId = doc.pageOrder[0];
    addObject(doc, pageId, createTextBlock({ pageId, rect: { x: 72, y: 72, width: 300, height: 40 }, text: "Hello world", fontSize: 18 }));

    const result = await pipeline.run({ document: doc, source: null });
    expect(result.pageCount).toBe(1);
    expect(result.diagnostics.some((d) => d.code === "MISSING_SOURCE")).toBe(true);
    expect((await reload(result.bytes)).getPageCount()).toBe(1);
  });

  it("handles page reorder + duplicate via pageOrder", async () => {
    const source = await makeSourcePdf(2);
    const doc = makeDoc(2);
    // duplicate page 0 at the end, reverse the first two
    const [a, b] = doc.pageOrder;
    doc.pageOrder = [b, a, a];

    const result = await pipeline.run({ document: doc, source });
    expect(result.pageCount).toBe(3);
    expect((await reload(result.bytes)).getPageCount()).toBe(3);
  });

  it("applies page rotation", async () => {
    const source = await makeSourcePdf(1);
    const doc = makeDoc(1);
    doc.pages[doc.pageOrder[0]].rotation = 90;
    const result = await pipeline.run({ document: doc, source });
    const reloaded = await reload(result.bytes);
    expect(reloaded.getPage(0).getRotation().angle).toBe(90);
  });

  it("renders all object kinds without throwing", async () => {
    const doc = makeDoc(1);
    const pageId = doc.pageOrder[0];

    addObject(doc, pageId, createTextBlock({ pageId, rect: { x: 50, y: 50, width: 400, height: 60 }, text: "Added text that should wrap across multiple lines nicely.", fontSize: 14, align: "justify" }));
    addObject(doc, pageId, { ...createTextBlock({ pageId, rect: { x: 50, y: 120, width: 200, height: 20 }, text: "edited", source: "original" }), metadata: { whiteoutBounds: [{ x: 50, y: 120, width: 200, height: 20 }] } } as never);
    addObject(doc, pageId, createImageObject({ pageId, rect: { x: 60, y: 160, width: 80, height: 80 }, src: PNG_1x1, mimeType: "image/png", naturalWidth: 1, naturalHeight: 1 }));
    addObject(doc, pageId, createSignature({ pageId, rect: { x: 60, y: 260, width: 160, height: 50 }, signatureType: "typed", text: "Jane Doe" }));
    addObject(doc, pageId, createSignature({ pageId, rect: { x: 240, y: 260, width: 120, height: 50 }, signatureType: "image", src: PNG_1x1 }));
    addObject(doc, pageId, createRedaction({ pageId, rect: { x: 60, y: 330, width: 120, height: 16 }, removeUnderlying: true }));

    for (const shape of ["rectangle", "ellipse", "line", "arrow"] as const) {
      addObject(doc, pageId, createAnnotation({ pageId, rect: { x: 60, y: 360, width: 100, height: 40 }, annotationType: "shape", shape, points: [60, 360, 160, 400], fill: "#00ff0040" }));
    }
    addObject(doc, pageId, createAnnotation({ pageId, rect: { x: 60, y: 410, width: 200, height: 14 }, annotationType: "highlight", quadPoints: [60, 410, 260, 410, 60, 424, 260, 424] }));
    addObject(doc, pageId, createAnnotation({ pageId, rect: { x: 60, y: 430, width: 100, height: 40 }, annotationType: "ink", points: [60, 430, 80, 450, 120, 440, 160, 470] }));
    addObject(doc, pageId, createAnnotation({ pageId, rect: { x: 300, y: 410, width: 16, height: 16 }, annotationType: "note", text: "a comment" }));
    addObject(doc, pageId, createAnnotation({ pageId, rect: { x: 300, y: 440, width: 120, height: 40 }, annotationType: "stamp", text: "APPROVED" }));

    doc.ocrLayers[pageId] = createOCRLayer({
      pageId,
      words: [
        { id: "w1", text: "scanned", rect: { x: 72, y: 600, width: 60, height: 12 }, confidence: 0.9 },
        { id: "w2", text: "text", rect: { x: 140, y: 600, width: 30, height: 12 }, confidence: 0.95 },
      ],
    });

    const result = await pipeline.run({ document: doc, source: null });
    expect(result.pageCount).toBe(1);
    expect(result.diagnostics.some((d) => d.code === "REDACTION_VISUAL_ONLY")).toBe(true);
    expect((await reload(result.bytes)).getPageCount()).toBe(1);
  });

  it("writes metadata (override > model > source)", async () => {
    const source = await makeSourcePdf(1);
    const doc = makeDoc(1);
    const result = await pipeline.run({
      document: doc,
      source,
      options: { metadata: { title: "Override Title", author: "Me", keywords: ["a", "b"] } },
    });
    const reloaded = await reload(result.bytes);
    expect(reloaded.getTitle()).toBe("Override Title");
    expect(reloaded.getAuthor()).toBe("Me");
  });

  it("raises a clear diagnostic when a password is requested", async () => {
    const doc = makeDoc(1);
    const result = await pipeline.run({ document: doc, source: null, options: { password: "secret" } });
    expect(result.diagnostics.some((d) => d.code === "ENCRYPTION_UNSUPPORTED")).toBe(true);
  });

  it("produces byte-identical output in deterministic mode", async () => {
    const source = await makeSourcePdf(1);
    const doc = makeDoc(1);
    addObject(doc, doc.pageOrder[0], createTextBlock({ pageId: doc.pageOrder[0], rect: { x: 50, y: 50, width: 300, height: 30 }, text: "deterministic", fontSize: 16 }));

    const a = await pipeline.run({ document: doc, source, options: { deterministic: true } });
    const b = await pipeline.run({ document: doc, source, options: { deterministic: true } });
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  it("reports progress monotonically and finishes at 1", async () => {
    const doc = makeDoc(2);
    const seen: number[] = [];
    await new ExportPipeline().run({
      document: doc,
      source: await makeSourcePdf(2),
      options: { onProgress: (p) => seen.push(p) },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it("supports cancellation via AbortSignal", async () => {
    const doc = makeDoc(3);
    const controller = new AbortController();
    controller.abort();
    await expect(
      new ExportPipeline().run({ document: doc, source: null, options: { signal: controller.signal } }),
    ).rejects.toThrow(/cancel/i);
  });
});

describe("performance smoke", () => {
  it("exports a 50-page document with many objects in reasonable time", async () => {
    const doc = makeDoc(50);
    for (const pageId of doc.pageOrder) {
      for (let i = 0; i < 20; i++) {
        addObject(doc, pageId, createTextBlock({ pageId, rect: { x: 40, y: 40 + i * 12, width: 300, height: 12 }, text: `row ${i}`, fontSize: 9 }));
      }
    }
    const start = Date.now();
    const result = await new ExportPipeline().run({ document: doc, source: null });
    const elapsed = Date.now() - start;
    expect(result.pageCount).toBe(50);
    // Generous bound; just guards against pathological blow-ups in CI.
    expect(elapsed).toBeLessThan(20_000);
  });
});
