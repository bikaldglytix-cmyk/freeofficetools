import { describe, expect, it } from "vitest";
import type { GlyphRun, TextBlock } from "./types";
import type { OCRLayer } from "@/lib/pdf/editor/model/types";
import { analyzePdfFont, cssFontFamily, defaultTextStyle, matchFont } from "./fonts";
import {
  clampRect,
  expandRect,
  pdfToViewportRect,
  rectContainsPoint,
  rectIntersects,
  unionRects,
  viewportToPdfRect,
} from "./geometry";
import {
  groupRunsIntoLines,
  inferBoundsFromText,
  reconstructTextBlocks,
  type ReconstructionOptions,
} from "./reconstruction";
import {
  createAddedTextOperation,
  createReplacementTextOperation,
  styleTextOperation,
  textBlockToEditorObject,
  updateTextContentOperation,
} from "./operations";
import { normalizeRuns, runStyleKey, runsFromSpans } from "./rich-runs";
import { createNewTextInstruction, createWhiteoutRestampInstruction } from "./whiteout";
import { groupOcrWords, ocrLayerToTextObjects } from "./ocr";

const OPTS: Required<ReconstructionOptions> = {
  lineToleranceRatio: 0.55,
  wordGapRatio: 0.42,
  paragraphGapRatio: 1.25,
  columnGapRatio: 3,
  fontSizeJumpRatio: 0.2,
};

function run(text: string, x: number, y: number, w = 20, h = 14): GlyphRun {
  return {
    id: `r_${x}_${y}_${text}`,
    text,
    bounds: { x, y, width: w, height: h },
    transform: [1, 0, 0, 1, x, y],
    style: defaultTextStyle(),
    sourceItemIndex: 0,
    charStart: 0,
    charEnd: text.length,
  };
}

function nativeBlock(): TextBlock {
  const [block] = reconstructTextBlocks({
    documentId: "doc1",
    pageId: "page1",
    runs: [run("Hello", 0, 100), run("World", 60, 100)],
  });
  return block;
}

describe("text/geometry", () => {
  it("unions rects to their bounding box", () => {
    expect(unionRects([{ x: 10, y: 10, width: 10, height: 10 }, { x: 30, y: 5, width: 10, height: 20 }])).toEqual({
      x: 10,
      y: 5,
      width: 30,
      height: 20,
    });
  });

  it("returns a zero rect for an empty union", () => {
    expect(unionRects([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("round-trips between pdf and viewport coordinates at any zoom", () => {
    const rect = { x: 12, y: 34, width: 56, height: 78 };
    expect(viewportToPdfRect(pdfToViewportRect(rect, 2.5), 2.5)).toEqual(rect);
  });

  it("expands symmetrically and tests intersection/containment", () => {
    expect(expandRect({ x: 10, y: 10, width: 10, height: 10 }, 2)).toEqual({ x: 8, y: 8, width: 14, height: 14 });
    expect(rectIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectIntersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
    expect(rectContainsPoint({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5 })).toBe(true);
  });

  it("clamps a rect inside the page box", () => {
    const clamped = clampRect({ x: -50, y: -50, width: 9999, height: 9999 }, { width: 600, height: 800 });
    expect(clamped).toEqual({ x: 0, y: 0, width: 600, height: 800 });
  });
});

describe("text/fonts", () => {
  it("strips subset prefixes and detects weight/style/serif", () => {
    const bold = analyzePdfFont("ABCDEF+Times-Bold");
    expect(bold.subset).toBe(true);
    expect(bold.weight).toBe(700);
    expect(bold.fallbackFamily).toBe("Times New Roman");

    const italic = analyzePdfFont("Helvetica-Oblique");
    expect(italic.style).toBe("italic");
    expect(italic.fallbackFamily).toBe("Arial");

    const mono = analyzePdfFont("CourierNewPSMT");
    expect(mono.fallbackFamily).toBe("Courier New");
  });

  it("matches available fonts and flags availability", () => {
    const matched = matchFont(analyzePdfFont("Arial"));
    expect(matched.available).toBe(true);
    expect(matched.family).toBe("Arial");

    const unmatched = matchFont(analyzePdfFont("SomeProprietaryFont"));
    expect(unmatched.available).toBe(false);
  });

  it("builds a default style and a CSS font stack", () => {
    const style = defaultTextStyle({ fontSize: 18 });
    expect(style.fontSize).toBe(18);
    expect(cssFontFamily(style.font)).toContain("sans-serif");
  });
});

describe("text/reconstruction", () => {
  it("groups runs on the same baseline into one line with word spacing", () => {
    const lines = groupRunsIntoLines([run("Hello", 0, 100), run("World", 60, 100)], OPTS);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain("Hello");
    expect(lines[0].text).toContain("World");
    expect(lines[0].text).toContain(" ");
  });

  it("separates runs on distinct baselines into distinct lines", () => {
    const lines = groupRunsIntoLines([run("A", 0, 100), run("B", 0, 130)], OPTS);
    expect(lines).toHaveLength(2);
  });

  it("splits paragraphs on large vertical gaps", () => {
    const blocks = reconstructTextBlocks({
      documentId: "doc1",
      pageId: "page1",
      runs: [run("Para1", 0, 100), run("Para1b", 0, 116), run("Para2", 0, 160)],
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].provenance.kind).toBe("native");
    expect(blocks[0].documentId).toBe("doc1");
  });

  it("infers a sensible bounding box from raw text", () => {
    const bounds = inferBoundsFromText("line one\nline two", 10, 20, 12);
    expect(bounds.x).toBe(10);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(12);
  });
});

describe("text/operations", () => {
  it("creates an ADD_TEXT op for brand-new text with new-text export metadata", () => {
    const op = createAddedTextOperation({ pageId: "page1", rect: { x: 0, y: 0, width: 100, height: 20 }, text: "Hi" });
    expect(op.type).toBe("ADD_TEXT");
    if (op.type !== "ADD_TEXT") throw new Error("unreachable");
    expect(op.object.kind).toBe("text");
    expect(op.object.source).toBe("added");
    expect(op.object.text).toBe("Hi");
    expect((op.object.metadata.export as { kind: string }).kind).toBe("new-text");
  });

  it("maps a style change onto UPDATE_TEXT fields and preserves the whiteout region", () => {
    const obj = textBlockToEditorObject(nativeBlock()); // source "original", carries export.whiteout
    const op = styleTextOperation("page1", obj, { fontSize: 22, color: "#ff0000", align: "center" });
    expect(op.type).toBe("UPDATE_TEXT");
    if (op.type !== "UPDATE_TEXT") throw new Error("unreachable");
    expect(op.changes.fontSize).toBe(22);
    expect(op.changes.color).toBe("#ff0000");
    expect(op.changes.align).toBe("center");
    // Regression: styling must not clobber the original-text mask/redaction bounds.
    const exp = (op.changes.metadata as { export?: { whiteout?: { bounds?: unknown[] } } }).export;
    expect(exp?.whiteout?.bounds?.length).toBeGreaterThan(0);
  });

  it("produces a whiteout-restamp replacement for native text", () => {
    const op = createReplacementTextOperation({ source: nativeBlock(), text: "Replaced" });
    expect(op.type).toBe("ADD_TEXT");
    if (op.type !== "ADD_TEXT") throw new Error("unreachable");
    expect((op.object.metadata.export as { kind: string }).kind).toBe("whiteout-restamp");
  });

  it("marks a single-line native replacement noWrap; multi-line and added text still wrap", () => {
    const single = createReplacementTextOperation({ source: nativeBlock(), text: "Replaced with more words" });
    if (single.type !== "ADD_TEXT") throw new Error("unreachable");
    expect(single.object.noWrap).toBe(true);

    const [multi] = reconstructTextBlocks({
      documentId: "doc1",
      pageId: "page1",
      runs: [run("First", 0, 100), run("Second", 0, 116)],
    });
    expect(multi.lines.length).toBe(2);
    const multiOp = createReplacementTextOperation({ source: multi, text: "Two\nlines" });
    if (multiOp.type !== "ADD_TEXT") throw new Error("unreachable");
    expect(multiOp.object.noWrap).toBeUndefined();

    const added = createAddedTextOperation({ pageId: "page1", rect: { x: 0, y: 0, width: 100, height: 20 }, text: "Hi" });
    if (added.type !== "ADD_TEXT") throw new Error("unreachable");
    expect(added.object.noWrap).toBeUndefined();
  });

  it("converts an UPDATE_TEXT content edit, preserving restamp/whiteout metadata", () => {
    const obj = textBlockToEditorObject(nativeBlock()); // source "original", carries export.whiteout
    const op = updateTextContentOperation("page1", obj, "Edited");
    expect(op.type).toBe("UPDATE_TEXT");
    if (op.type !== "UPDATE_TEXT") throw new Error("unreachable");
    expect(op.changes.text).toBe("Edited");
    const exp = (op.changes.metadata as { export?: { text?: string; whiteout?: { bounds?: unknown[] } } }).export;
    expect(exp?.text).toBe("Edited");
    // Regression: the original-text mask/redaction bounds survive the content edit.
    expect(exp?.whiteout?.bounds?.length).toBeGreaterThan(0);
  });

  it("converts a text block into an editor object", () => {
    const editorObject = textBlockToEditorObject(nativeBlock());
    expect(editorObject.kind).toBe("text");
    expect(editorObject.text).toContain("Hello");
  });

  it("threads per-run formatting through a native replacement (mixed-bold fix)", () => {
    const runs = [
      { text: "keywords", bold: true, fontFamily: "Arial", fontSize: 12, color: "#000000" },
      { text: ": one two", bold: false, fontFamily: "Arial", fontSize: 12, color: "#000000" },
    ];
    const op = createReplacementTextOperation({ source: nativeBlock(), text: "keywords: one two", runs });
    if (op.type !== "ADD_TEXT") throw new Error("unreachable");
    expect(op.object.runs).toHaveLength(2);
    // Only the first run is bold — changing the rest of the line can't unbold it.
    expect(op.object.runs?.[0]).toMatchObject({ text: "keywords", bold: true });
    expect(op.object.runs?.[1]).toMatchObject({ bold: false });
  });

  it("updates content + runs together and keeps the whiteout region", () => {
    const obj = textBlockToEditorObject(nativeBlock());
    const runs = [{ text: "Edited", bold: true }];
    const op = updateTextContentOperation("page1", obj, "Edited", undefined, runs);
    if (op.type !== "UPDATE_TEXT") throw new Error("unreachable");
    expect(op.changes.text).toBe("Edited");
    expect(op.changes.runs).toEqual(runs);
    const exp = (op.changes.metadata as { export?: { whiteout?: { bounds?: unknown[] } } }).export;
    expect(exp?.whiteout?.bounds?.length).toBeGreaterThan(0);
  });

  it("propagates a whole-block style change onto existing runs", () => {
    const base = textBlockToEditorObject(nativeBlock());
    const withRuns = { ...base, runs: [{ text: "a", bold: false }, { text: "b", bold: true }] };
    const op = styleTextOperation("page1", withRuns, { fontSize: 20 });
    if (op.type !== "UPDATE_TEXT") throw new Error("unreachable");
    expect(op.changes.runs).toHaveLength(2);
    expect(op.changes.runs?.every((r) => r.fontSize === 20)).toBe(true);
    // ...without flattening the per-run weight that makes the line mixed.
    expect(op.changes.runs?.[0].bold).toBe(false);
    expect(op.changes.runs?.[1].bold).toBe(true);
  });
});

describe("text/rich-runs", () => {
  it("builds one run per native span, carrying its style", () => {
    const block = nativeBlock();
    const runs = runsFromSpans(block.lines[0].spans);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.map((r) => r.text).join("")).toContain("Hello");
    expect(runs[0]).toHaveProperty("fontSize");
  });

  it("merges adjacent runs that share a style and drops empties", () => {
    const merged = normalizeRuns([
      { text: "foo", bold: true },
      { text: "bar", bold: true },
      { text: "", bold: true },
      { text: "baz", bold: false },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ text: "foobar", bold: true });
    expect(merged[1]).toMatchObject({ text: "baz", bold: false });
  });

  it("distinguishes runs by style key", () => {
    expect(runStyleKey({ text: "x", bold: true })).not.toBe(runStyleKey({ text: "x", bold: false }));
    expect(runStyleKey({ text: "a", bold: true })).toBe(runStyleKey({ text: "b", bold: true }));
  });
});

describe("text/whiteout", () => {
  it("emits a whiteout-restamp instruction covering each source line", () => {
    const source = nativeBlock();
    const instruction = createWhiteoutRestampInstruction(source, { objectId: "obj1", text: "New" });
    expect(instruction.kind).toBe("whiteout-restamp");
    expect(instruction.whiteout?.bounds.length).toBe(source.lines.length);
    expect(instruction.text).toBe("New");
  });

  it("emits a new-text instruction for added blocks", () => {
    const instruction = createNewTextInstruction(nativeBlock());
    expect(instruction.kind).toBe("new-text");
  });

  it("masks the full ink extent: descenders below the baseline are covered", () => {
    // Runs report a 3.5pt descent → the line's inkBounds must reach below the
    // layout bounds, and the whiteout mask must cover that strip (plus halo).
    const [block] = reconstructTextBlocks({
      documentId: "doc1",
      pageId: "page1",
      runs: [{ ...run("gyp", 0, 100), descent: 3.5 }],
    });
    const line = block.lines[0];
    expect(line.inkBounds).toBeDefined();
    expect(line.inkBounds!.y + line.inkBounds!.height).toBeCloseTo(
      line.bounds.y + line.bounds.height + 3.5,
    );

    const instruction = createWhiteoutRestampInstruction(block, { objectId: "obj1", text: "New" });
    const mask = instruction.whiteout!.bounds[0];
    const lineBottom = line.bounds.y + line.bounds.height;
    expect(mask.y + mask.height).toBeGreaterThanOrEqual(lineBottom + 3.5);
  });

  it("keeps the mask below the line above: top stays within ~0.9em of the baseline", () => {
    // Extraction reports a full em of height above the baseline, but real
    // glyphs stop ~0.9em up — an em-tall mask would cover the descenders of a
    // single-spaced line above (the "neighbours vanish behind white" bug).
    const source = nativeBlock(); // 14pt style, baseline at y+height
    const line = source.lines[0];
    const mask = createWhiteoutRestampInstruction(source, { objectId: "obj1", text: "New" }).whiteout!.bounds[0];
    expect(mask.y).toBeGreaterThanOrEqual(line.baseline - 0.9 * 14 - 0.36);
    // …while still covering the line's own ink bottom (descender strip).
    const ink = line.inkBounds ?? line.bounds;
    expect(mask.y + mask.height).toBeGreaterThanOrEqual(ink.y + ink.height);
  });
});

describe("text/ocr", () => {
  const layer: OCRLayer = {
    id: "ocr1",
    pageId: "page1",
    engine: "tesseract",
    language: "eng",
    words: [
      { id: "w1", text: "foo", rect: { x: 0, y: 0, width: 30, height: 12 }, confidence: 0.9 },
      { id: "w2", text: "bar", rect: { x: 35, y: 0, width: 30, height: 12 }, confidence: 0.7 },
    ],
    createdAt: 1,
    updatedAt: 2,
    metadata: {},
  };

  it("maps each OCR word to a confidence-tagged text object", () => {
    const objects = ocrLayerToTextObjects("doc1", "page1", layer);
    expect(objects).toHaveLength(2);
    expect(objects[0].provenance.kind).toBe("ocr");
    expect(objects[0].provenance.kind === "ocr" && objects[0].provenance.confidence).toBe(0.9);
    expect(objects[0].text).toBe("foo");
  });

  it("groups OCR words into one block with averaged confidence", () => {
    const block = groupOcrWords("doc1", "page1", layer);
    expect(block.text).toBe("foo bar");
    expect(block.provenance.kind === "ocr" && block.provenance.confidence).toBeCloseTo(0.8);
    expect(block.bounds.width).toBe(65);
  });
});
