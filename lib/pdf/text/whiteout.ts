import { newId } from "@/lib/pdf/editor/model/ids";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { expandRect } from "./geometry";
import type { TextBlock, TextExportInstruction, TextLine, TextStyle } from "./types";

/** The rect a mask must cover to fully hide a line: its ink extent (including
 *  the descender strip below the baseline) plus a halo for antialiased edges.
 *  Exported so the live editing layer masks the EXACT same rect the commit
 *  will store — keeping live and committed removal regions key-identical. */
export function lineMaskRect(line: TextLine): Rect {
  return expandRect(line.inkBounds ?? line.bounds, 1.2);
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
