import { newId } from "@/lib/pdf/editor/model/ids";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { expandRect } from "./geometry";
import type { TextBlock, TextExportInstruction, TextLine, TextStyle } from "./types";

/**
 * The rect a mask must cover to fully hide a line: the real glyph zone —
 * ascenders/caps/diacritics above the baseline down to the descender strip —
 * plus a small halo for antialiased edges.
 *
 * Deliberately NOT the raw ink box: extraction reports a full em of height
 * above the baseline, which in single-spaced text overlaps the descenders of
 * the line ABOVE (and, at tight leading, the ascenders of the line BELOW), so
 * an em-tall mask visibly amputates neighbouring lines — the "text above/below
 * disappears behind a white box" bug. Real glyphs top out ~0.9 em above the
 * baseline, so the mask top is clamped there; the halo is generous
 * horizontally (side bearings) but thin vertically (only antialiasing).
 *
 * Exported so the live editing layer masks the EXACT same rect the commit
 * will store — keeping live and committed removal regions key-identical.
 */
export function lineMaskRect(line: TextLine): Rect {
  const ink = line.inkBounds ?? line.bounds;
  let maxFont = 0;
  for (const span of line.spans) {
    maxFont = Math.max(maxFont, span.style.fontSize);
    for (const run of span.runs) maxFont = Math.max(maxFont, run.style.fontSize);
  }
  if (!(maxFont > 0) || !Number.isFinite(line.baseline)) return expandRect(ink, 1.2);
  // Visual space (y down): baseline − 0.9·fontSize is the realistic ascender
  // ceiling; never reach above the reported ink top.
  const top = Math.max(ink.y, line.baseline - 0.9 * maxFont) - 0.35;
  const bottom = ink.y + ink.height + 0.35;
  return { x: ink.x - 1.2, y: top, width: ink.width + 2.4, height: Math.max(1, bottom - top) };
}

export function createWhiteoutRestampInstruction(
  source: TextBlock,
  replacement: { objectId: string; text: string; bounds?: Rect; style?: TextStyle },
): TextExportInstruction {
  return {
    id: newId("txt_export"),
    pageId: source.pageId,
    objectId: replacement.objectId,
    kind: source.provenance.kind === "ocr" ? "ocr-correction" : "whiteout-restamp",
    bounds: replacement.bounds ?? source.bounds,
    text: replacement.text,
    style: replacement.style ?? source.style,
    whiteout: {
      bounds: source.lines.length ? source.lines.map(lineMaskRect) : [expandRect(source.bounds, 1.2)],
      fill: "#ffffff",
    },
    source: source.provenance,
  };
}

/** Read the original-glyph mask rects an edited block stored at edit time
 *  (`metadata.export.whiteout.bounds`); [] when the object isn't a native edit. */
export function storedWhiteoutBounds(metadata: Record<string, unknown> | undefined): Rect[] {
  const exp = metadata?.export as { whiteout?: { bounds?: Rect[] } } | undefined;
  const bounds = exp?.whiteout?.bounds;
  return Array.isArray(bounds) ? bounds : [];
}

export function createNewTextInstruction(block: TextBlock): TextExportInstruction {
  return {
    id: newId("txt_export"),
    pageId: block.pageId,
    objectId: block.id,
    kind: "new-text",
    bounds: block.bounds,
    text: block.text,
    style: block.style,
    source: block.provenance,
  };
}
