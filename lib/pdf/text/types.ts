import type {
  ActorId,
  DocumentId,
  Matrix,
  ObjectId,
  PageId,
  Rect,
  TextAlign,
} from "@/lib/pdf/editor/model/types";

export type TextObjectId = ObjectId;

export interface FontReference {
  id: string;
  pdfName?: string;
  family: string;
  fallbackFamily: string;
  /**
   * The @font-face family pdf.js registered for the embedded font program
   * (its internal loaded name, e.g. "g_d0_f3"). Rendering with it first in the
   * CSS stack shows the document's EXACT glyphs; characters missing from the
   * subset fall through to `fallbackFamily`. Only valid while the source
   * document is open in the viewer.
   */
  cssName?: string;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic" | "oblique";
  embedded: boolean;
  subset: boolean;
  available: boolean;
}

export interface TextStyle {
  font: FontReference;
  fontSize: number;
  color: string;
  opacity: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
}

export interface GlyphRun {
  id: string;
  text: string;
  bounds: Rect;
  transform: Matrix;
  style: TextStyle;
  sourceItemIndex: number;
  charStart: number;
  charEnd: number;
  /** Descender depth in points below the baseline (bounds bottom). Glyphs like
   *  g/y/p paint inside this strip, so masks must extend down by it. */
  descent?: number;
}

export interface TextSpan {
  id: string;
  text: string;
  bounds: Rect;
  runs: GlyphRun[];
  style: TextStyle;
}

export interface TextLine {
  id: string;
  text: string;
  bounds: Rect;
  /** Full glyph-ink extent: `bounds` plus the descender strip below the
   *  baseline. Whiteout masks and glyph removal must use this, not `bounds`,
   *  or descenders (g/y/p) peek out beneath the mask. */
  inkBounds?: Rect;
  spans: TextSpan[];
  baseline: number;
  direction: "ltr" | "rtl" | "ttb";
}

export interface TextBlock {
  id: string;
  documentId: DocumentId;
  pageId: PageId;
  text: string;
  bounds: Rect;
  lines: TextLine[];
  style: TextStyle;
  transforms: {
    rotation: number;
    matrix: Matrix;
  };
  opacity: number;
  zIndex: number;
  provenance: TextProvenance;
  createdAt: number;
  updatedAt: number;
  author?: ActorId;
  metadata: Record<string, unknown>;
}

export type TextProvenance =
  | { kind: "native"; pdfItemIds: string[]; confidence: 1; editable: "overlay-replacement" }
  | { kind: "ocr"; ocrWordIds: string[]; confidence: number; editable: "ocr-correction" }
  | { kind: "added"; confidence: 1; editable: "direct" };

export interface EditableTextObject extends TextBlock {
  provenance: Extract<TextProvenance, { kind: "native" | "added" }>;
}

export interface OCRTextObject extends TextBlock {
  provenance: Extract<TextProvenance, { kind: "ocr" }>;
}

export interface TextSelection {
  pageId: PageId;
  blockIds: TextObjectId[];
  anchor: { blockId: TextObjectId; offset: number };
  focus: { blockId: TextObjectId; offset: number };
  bounds: Rect[];
}

export type TextEditOperation =
  | { type: "ADD_TEXT"; pageId: PageId; objectId: TextObjectId; text: string; bounds: Rect; style: TextStyle }
  | { type: "UPDATE_TEXT"; pageId: PageId; objectId: TextObjectId; text?: string; style?: Partial<TextStyle>; bounds?: Rect }
  | { type: "DELETE_TEXT"; pageId: PageId; objectId: TextObjectId }
  | { type: "MOVE_TEXT"; pageId: PageId; objectId: TextObjectId; bounds: Rect }
  | { type: "STYLE_TEXT"; pageId: PageId; objectId: TextObjectId; style: Partial<TextStyle> }
  | { type: "REPLACE_TEXT"; pageId: PageId; sourceBlockId: TextObjectId; replacementId: TextObjectId; text: string };

export interface ExtractedTextPage {
  documentId: DocumentId;
  pageId: PageId;
  pageIndex: number;
  width: number;
  height: number;
  blocks: TextBlock[];
  extractedAt: number;
}

export interface TextExportInstruction {
  id: string;
  pageId: PageId;
  objectId: TextObjectId;
  kind: "new-text" | "whiteout-restamp" | "ocr-correction" | "delete";
  bounds: Rect;
  text?: string;
  style?: TextStyle;
  whiteout?: {
    bounds: Rect[];
    fill: string;
  };
  source?: TextProvenance;
}
