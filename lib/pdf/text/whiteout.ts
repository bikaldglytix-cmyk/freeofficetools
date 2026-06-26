import { newId } from "@/lib/pdf/editor/model/ids";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { expandRect } from "./geometry";
import type { TextBlock, TextExportInstruction, TextStyle } from "./types";

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
      bounds: source.lines.length ? source.lines.map((line) => expandRect(line.bounds, 1.2)) : [expandRect(source.bounds, 1.2)],
      fill: "#ffffff",
    },
    source: source.provenance,
  };
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
