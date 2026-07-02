/**
 * Real-font embedding tests (Phase 1 of the Acrobat-grade rebuild). These guard
 * the trust-critical fix: edited text must download in the SAME typeface the
 * editor showed on screen. We run in Node with an fs-based loader that reads
 * the bundled TTFs from `public/fonts/`, exercising the exact fontkit path the
 * browser uses (only the byte source differs).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { classifyFamily, resolveBundledFace } from "@/lib/pdf/fonts/face-map";
import { createDocument, createPage, createTextBlock } from "../model/factory";
import type { DocumentState, PageId } from "../model/types";
import type { FontByteLoader } from "./font-loader";
import { FontManager } from "./fonts";
import { ExportPipeline } from "./pipeline";

const fsLoader: FontByteLoader = async (file) =>
  new Uint8Array(await readFile(path.join(process.cwd(), "public", "fonts", file)));

function makeDoc(): { doc: DocumentState; pageId: PageId } {
  const page = createPage({ size: { width: 612, height: 792 }, sourcePageIndex: null });
  const doc = createDocument({ fileName: "t.pdf", pages: [page] });
  return { doc, pageId: page.id };
}

function addText(doc: DocumentState, pageId: PageId, text: string, fontFamily: string): void {
  const block = createTextBlock({
    pageId,
    rect: { x: 50, y: 50, width: 400, height: 20 },
    text,
    fontFamily,
    fontSize: 12,
  });
  doc.objectsByPage[pageId][block.id] = block;
  doc.objectOrder[pageId].push(block.id);
}

/**
 * All object dictionaries of the saved PDF, decompressed and stringified.
 * (pdf-lib packs dicts into compressed object streams on save, so a raw-byte
 * substring search can NOT see names like /BaseFont — reload + enumerate can.)
 */
async function objectGraph(bytes: Uint8Array): Promise<string> {
  const reloaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return reloaded.context
    .enumerateIndirectObjects()
    .map(([, obj]) => String(obj))
    .join("\n");
}

describe("face-map — shared family classification", () => {
  it("buckets common families and strips subset prefixes", () => {
    expect(classifyFamily("Arial").group).toBe("liberation-sans");
    expect(classifyFamily("ABCDEF+TimesNewRomanPSMT").group).toBe("liberation-serif");
    expect(classifyFamily("Courier New").group).toBe("liberation-mono");
    expect(classifyFamily("Helvetica").group).toBe("liberation-sans");
    expect(classifyFamily(undefined).matched).toBe(false);
  });

  it("never misreads the 'serif' inside 'sans-serif' as a serif face", () => {
    expect(classifyFamily("sans-serif").group).toBe("liberation-sans");
  });

  it("derives weight/slant from the name when booleans are absent", () => {
    const face = resolveBundledFace({ family: "Helvetica-BoldOblique" });
    expect(face.weight).toBe(700);
    expect(face.style).toBe("italic");
    expect(face.file).toBe("LiberationSans-BoldItalic.ttf");
  });

  it("explicit booleans override name hints", () => {
    const face = resolveBundledFace({ family: "Arial-Bold", bold: false, italic: false });
    expect(face.file).toBe("LiberationSans-Regular.ttf");
  });
});

describe("FontManager — preload + resolve", () => {
  it("embeds real faces once and resolves them synchronously", async () => {
    const doc = await PDFDocument.create();
    const fonts = new FontManager(doc);
    await fonts.preload([{ family: "Times New Roman", italic: true }], fsLoader);

    const resolved = fonts.resolveFont({ family: "Times New Roman", italic: true });
    expect(resolved.fallback).toBe(false);
    expect(resolved.face?.file).toBe("LiberationSerif-Italic.ttf");
  });

  it("falls back to a standard font when the loader yields nothing", async () => {
    const doc = await PDFDocument.create();
    const fonts = new FontManager(doc);
    await fonts.preload([{ family: "Arial" }], async () => null);

    const resolved = fonts.resolveFont({ family: "Arial" });
    expect(resolved.fallback).toBe(true);
    expect(resolved.standard).toBeDefined();
    expect(fonts.takeDiagnostics().some((d) => d.code === "FONT_EMBED_FALLBACK")).toBe(true);
  });

  it("resolves an unpreloaded request to a standard font instead of throwing", async () => {
    const doc = await PDFDocument.create();
    const fonts = new FontManager(doc);
    await fonts.preload([{ family: "Arial" }], fsLoader);

    // Mono was never requested → not embedded → graceful standard fallback.
    const resolved = fonts.resolveFont({ family: "Courier New" });
    expect(resolved.fallback).toBe(true);
  });
});

describe("pipeline — real fonts in the downloaded PDF", () => {
  it("embeds the matching Liberation face for edited text (the font-mismatch fix)", async () => {
    const { doc, pageId } = makeDoc();
    addText(doc, pageId, "Payment due within 30 days — Résumé attaché.", "Times New Roman");

    const result = await new ExportPipeline({ fontLoader: fsLoader }).run({ document: doc });

    const graph = await objectGraph(result.bytes);
    expect(graph).toContain("LiberationSerif");
    // A real font PROGRAM is embedded (standard-14 fonts carry no FontFile).
    expect(graph).toContain("FontFile2");
    // No glyph was dropped: accented Latin is embedded for real, not "?"-substituted.
    expect(result.diagnostics.some((d) => d.code === "FONT_GLYPH")).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "FONT_EMBED_FALLBACK")).toBe(false);
  });

  it("subsets the embedded face rather than shipping the whole TTF", async () => {
    const { doc, pageId } = makeDoc();
    addText(doc, pageId, "Hi", "Arial");

    const result = await new ExportPipeline({ fontLoader: fsLoader }).run({ document: doc });

    // LiberationSans-Regular.ttf is ~410 KB; a 2-glyph subset must be far smaller.
    expect(result.byteLength).toBeLessThan(100_000);
    expect(await objectGraph(result.bytes)).toContain("LiberationSans");
  });

  it("degrades to standard fonts (previous behaviour) with a null loader", async () => {
    const { doc, pageId } = makeDoc();
    addText(doc, pageId, "Total: 500 円", "Arial"); // 円 is outside WinAnsi

    const result = await new ExportPipeline({ fontLoader: null }).run({ document: doc });

    const graph = await objectGraph(result.bytes);
    expect(graph).not.toContain("Liberation");
    expect(graph).toContain("Helvetica");
    // The CJK char can't be encoded by a standard font → "?" + diagnostic.
    expect(result.diagnostics.some((d) => d.code === "FONT_GLYPH")).toBe(true);
  });

  it("never crashes the export on glyphs no bundled face covers", async () => {
    const { doc, pageId } = makeDoc();
    addText(doc, pageId, "gothic: \u{10348}", "Arial"); // Gothic block — not in Liberation/Noto Sans

    const result = await new ExportPipeline({ fontLoader: fsLoader }).run({ document: doc });

    // Per-object recovery may skip the block, but the document must survive.
    const reloaded = await PDFDocument.load(result.bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
