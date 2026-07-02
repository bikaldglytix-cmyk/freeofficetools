/**
 * Canonical document model for the PDF Editor (Phase 2).
 *
 * This is the single source of truth that the viewer, annotation layer, OCR,
 * and export engine all read from and write to. It is deliberately:
 *
 *  - **Normalized & sharded** — objects live under `objectsByPage[pageId][id]`
 *    so a single edit only ever copies one page's objects, never all of them.
 *  - **Plain JSON** — no class instances, Dates or Maps, so the whole tree is
 *    serializable, structurally cloneable, replayable and collaboration-ready.
 *  - **Collaboration-aware** — every object and operation carries actor +
 *    timestamps, which a future CRDT/OT layer can use without schema changes.
 *
 * COORDINATE SYSTEM: all geometry is in **PDF points (1/72")** with a
 * **top-left origin** (y grows downward), per page. This is resolution
 * independent: the viewer multiplies by zoom, the export engine flips y to
 * PDF's bottom-left space. Never store screen pixels here.
 */

// ---------------------------------------------------------------------------
// Identifiers & primitives
// ---------------------------------------------------------------------------

export type DocumentId = string;
export type PageId = string;
export type ObjectId = string;
export type RevisionId = string;
export type ActorId = string;

/** Axis-aligned bounding box in page points, top-left origin. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Affine transform [a, b, c, d, e, f] applied around the object's top-left. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

export interface PageSize {
  /** Width in points. */
  width: number;
  /** Height in points. */
  height: number;
}

// ---------------------------------------------------------------------------
// Object base — shared by every editable object on a page
// ---------------------------------------------------------------------------

export type ObjectKind = "text" | "image" | "annotation" | "signature" | "redaction";

export interface BaseObject {
  id: ObjectId;
  pageId: PageId;
  kind: ObjectKind;
  /** Bounding box (points, top-left origin). */
  rect: Rect;
  /** Extra rotation in degrees, applied on top of the page rotation. */
  rotation: number;
  /** Optional affine transform for skew/scale beyond the bounding box. */
  transform: Matrix;
  /** Paint order within the page; higher draws on top. */
  zIndex: number;
  /** 0..1. */
  opacity: number;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: ActorId;
  updatedBy?: ActorId;
  /** Free-form, never interpreted by the engine. */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export type TextAlign = "left" | "center" | "right" | "justify";

/** A styled span inside a text block (rich text; optional in Phase 2). */
export interface TextRun {
  text: string;
  fontFamily?: string;
  /** Embedded pdf.js @font-face family (e.g. "g_d0_f3") rendered before
   *  `fontFamily` so the run keeps the document's exact glyphs on screen. */
  pdfFontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface TextBlock extends BaseObject {
  kind: "text";
  /** Canonical plain text; the source of truth for simple edits. */
  text: string;
  /** Optional rich runs; when present, overrides block-level styling. */
  runs?: TextRun[];
  fontFamily: string;
  /** Embedded pdf.js @font-face family for on-screen rendering (see TextRun). */
  pdfFontFamily?: string;
  fontSize: number;
  color: string;
  align: TextAlign;
  lineHeight: number;
  /** Block-level weight/slant, used when there are no per-run overrides. */
  bold?: boolean;
  italic?: boolean;
  /**
   * Never re-wrap this block's text to the rect width: extending it continues
   * on the same line (the box grows sideways), like Acrobat's single-line
   * edits. Set for edits of one native document line; hard `\n` still breaks.
   */
  noWrap?: boolean;
  /**
   * `original` = extracted from the source PDF (editing it triggers the
   * whiteout/restamp workflow in Phase 4). `added` = a brand-new text box.
   */
  source: "original" | "added";
  /** pdf.js text-item ids this block was derived from (whiteout mapping). */
  originalItemIds?: string[];
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface ImageObject extends BaseObject {
  kind: "image";
  /** Data URL or a key into the binary store (for large blobs). */
  src: string;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
}

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

export type AnnotationType = "highlight" | "note" | "ink" | "shape" | "stamp";
export type ShapeKind = "rectangle" | "ellipse" | "line" | "arrow";

export interface AnnotationObject extends BaseObject {
  kind: "annotation";
  annotationType: AnnotationType;
  color: string;
  fill?: string;
  strokeWidth?: number;
  /** Flattened [x0,y0,x1,y1,...] in page points for ink/line. */
  points?: number[];
  /** Highlight quads: groups of 4 points (8 numbers) per rectangle. */
  quadPoints?: number[];
  /** Note/comment body. */
  text?: string;
  author?: string;
  shape?: ShapeKind;
}

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

export type SignatureKind = "draw" | "image" | "typed";

export interface SignatureObject extends BaseObject {
  kind: "signature";
  signatureType: SignatureKind;
  /** Image data URL for `draw`/`image` signatures. */
  src?: string;
  /** Text for `typed` signatures. */
  text?: string;
  fontFamily?: string;
  strokeColor?: string;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export interface RedactionObject extends BaseObject {
  kind: "redaction";
  fillColor: string;
  /** If true, export must also strip text/images beneath this box. */
  removeUnderlying: boolean;
}

/** Discriminated union of everything that can live on a page. */
export type EditableObject =
  | TextBlock
  | ImageObject
  | AnnotationObject
  | SignatureObject
  | RedactionObject;

// ---------------------------------------------------------------------------
// OCR layer (one per page)
// ---------------------------------------------------------------------------

export interface OCRWord {
  id: string;
  text: string;
  rect: Rect;
  /** 0..1. */
  confidence: number;
}

export interface OCRLayer {
  id: string;
  pageId: PageId;
  engine: string;
  language: string;
  words: OCRWord[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Page & document
// ---------------------------------------------------------------------------

export interface PDFPageModel {
  id: PageId;
  size: PageSize;
  /** Page rotation in degrees (0 | 90 | 180 | 270). */
  rotation: number;
  /** Index in the original source PDF, or null for an inserted blank page. */
  sourcePageIndex: number | null;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface DocumentMeta {
  id: DocumentId;
  title: string;
  fileName: string;
  /** Bumped by migrations; see persistence/migrations.ts. */
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  /** pdf.js document fingerprint of the source file, when known. */
  pdfFingerprint?: string;
  author?: string;
  producer?: string;
  metadata: Record<string, unknown>;
}

/**
 * The canonical, normalized document state. All maps are plain objects keyed by
 * id; ordering lives in the *Order arrays so reordering never touches objects.
 */
export interface DocumentState {
  meta: DocumentMeta;
  /** Live page order (page ids). */
  pageOrder: PageId[];
  pages: Record<PageId, PDFPageModel>;
  /** Sharded by page so an edit only copies one page's objects. */
  objectsByPage: Record<PageId, Record<ObjectId, EditableObject>>;
  /** z-ordered object ids per page (ascending zIndex). */
  objectOrder: Record<PageId, ObjectId[]>;
  ocrLayers: Record<PageId, OCRLayer | undefined>;
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

export interface Revision {
  id: RevisionId;
  label: string;
  timestamp: number;
  schemaVersion: number;
  /** Full snapshot for one-click restore. */
  snapshot: DocumentState;
  /** Optional id of the patch that produced this revision. */
  patchId?: string;
  author?: ActorId;
  metadata: Record<string, unknown>;
}
