import { newId } from "@/lib/pdf/editor/model/ids";
import type { DocumentId, OCRLayer, PageId } from "@/lib/pdf/editor/model/types";
import { defaultTextStyle } from "./fonts";
import { unionRects } from "./geometry";
import type { OCRTextObject } from "./types";

export function ocrLayerToTextObjects(documentId: DocumentId, pageId: PageId, layer: OCRLayer): OCRTextObject[] {
  return layer.words.map((word, index) => ({
    id: newId(`txt_ocr_${index}`),
    documentId,
    pageId,
    text: word.text,
    bounds: word.rect,
    lines: [
      {
        id: newId("txt_ocr_line"),
        text: word.text,
        bounds: word.rect,
        spans: [],
        baseline: word.rect.y + word.rect.height,
        direction: "ltr",
      },
    ],
    style: defaultTextStyle({ fontSize: Math.max(10, word.rect.height * 0.85), color: "#111827" }),
    transforms: { rotation: 0, matrix: [1, 0, 0, 1, 0, 0] },
    opacity: 1,
    zIndex: index,
    provenance: { kind: "ocr", ocrWordIds: [word.id], confidence: word.confidence, editable: "ocr-correction" },
    createdAt: layer.createdAt,
    updatedAt: layer.updatedAt,
    metadata: { engine: layer.engine, language: layer.language },
  }));
}

export function groupOcrWords(documentId: DocumentId, pageId: PageId, layer: OCRLayer): OCRTextObject {
  const words = layer.words;
  const bounds = unionRects(words.map((word) => word.rect));
  const text = words.map((word) => word.text).join(" ");
  return {
    id: newId("txt_ocr_block"),
    documentId,
    pageId,
    text,
    bounds,
    lines: [],
    style: defaultTextStyle({ fontSize: Math.max(10, bounds.height * 0.8) }),
    transforms: { rotation: 0, matrix: [1, 0, 0, 1, 0, 0] },
    opacity: 1,
    zIndex: 0,
    provenance: {
      kind: "ocr",
      ocrWordIds: words.map((word) => word.id),
      confidence: words.length ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length : 0,
      editable: "ocr-correction",
    },
    createdAt: layer.createdAt,
    updatedAt: layer.updatedAt,
    metadata: { engine: layer.engine, language: layer.language },
  };
}
