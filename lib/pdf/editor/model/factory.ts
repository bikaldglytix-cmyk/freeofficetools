/**
 * Factory functions that build well-formed model objects with ids, timestamps
 * and sane defaults. Always create objects through these so invariants (every
 * field present, timestamps set, metadata object non-null) hold everywhere.
 */
import {
  IDENTITY_MATRIX,
  type ActorId,
  type AnnotationObject,
  type BaseObject,
  type DocumentMeta,
  type DocumentState,
  type EditableObject,
  type ImageObject,
  type OCRLayer,
  type PageId,
  type PageSize,
  type PDFPageModel,
  type RedactionObject,
  type Rect,
  type Revision,
  type SignatureObject,
  type TextBlock,
} from "./types";
import { newDocumentId, newId, newObjectId, newPageId, newRevisionId } from "./ids";

export const SCHEMA_VERSION = 1;

function now(): number {
  return Date.now();
}

interface BaseInput {
  pageId: PageId;
  rect: Rect;
  zIndex?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
  actor?: ActorId;
  metadata?: Record<string, unknown>;
}

function baseObject(kind: BaseObject["kind"], input: BaseInput): BaseObject {
  const ts = now();
  return {
    id: newObjectId(),
    pageId: input.pageId,
    kind,
    rect: input.rect,
    rotation: input.rotation ?? 0,
    transform: IDENTITY_MATRIX,
    zIndex: input.zIndex ?? 0,
    opacity: input.opacity ?? 1,
    locked: input.locked ?? false,
    visible: input.visible ?? true,
    createdAt: ts,
    updatedAt: ts,
    createdBy: input.actor,
    updatedBy: input.actor,
    metadata: input.metadata ?? {},
  };
}

// ----- Text -----------------------------------------------------------------

export interface CreateTextInput extends BaseInput {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  align?: TextBlock["align"];
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  source?: TextBlock["source"];
  runs?: TextBlock["runs"];
  originalItemIds?: string[];
}

export function createTextBlock(input: CreateTextInput): TextBlock {
  return {
    ...baseObject("text", input),
    kind: "text",
    text: input.text,
    runs: input.runs,
    fontFamily: input.fontFamily ?? "Helvetica",
    fontSize: input.fontSize ?? 12,
    color: input.color ?? "#000000",
    align: input.align ?? "left",
    lineHeight: input.lineHeight ?? 1.2,
    bold: input.bold,
    italic: input.italic,
    source: input.source ?? "added",
    originalItemIds: input.originalItemIds,
  };
}

// ----- Image ----------------------------------------------------------------

export interface CreateImageInput extends BaseInput {
  src: string;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
}

export function createImageObject(input: CreateImageInput): ImageObject {
  return {
    ...baseObject("image", input),
    kind: "image",
    src: input.src,
    mimeType: input.mimeType,
    naturalWidth: input.naturalWidth,
    naturalHeight: input.naturalHeight,
  };
}

// ----- Annotation -----------------------------------------------------------

export interface CreateAnnotationInput extends BaseInput {
  annotationType: AnnotationObject["annotationType"];
  color?: string;
  fill?: string;
  strokeWidth?: number;
  points?: number[];
  quadPoints?: number[];
  text?: string;
  author?: string;
  shape?: AnnotationObject["shape"];
}

export function createAnnotation(input: CreateAnnotationInput): AnnotationObject {
  return {
    ...baseObject("annotation", input),
    kind: "annotation",
    annotationType: input.annotationType,
    color: input.color ?? "#ffd400",
    fill: input.fill,
    strokeWidth: input.strokeWidth,
    points: input.points,
    quadPoints: input.quadPoints,
    text: input.text,
    author: input.author,
    shape: input.shape,
  };
}

// ----- Signature ------------------------------------------------------------

export interface CreateSignatureInput extends BaseInput {
  signatureType: SignatureObject["signatureType"];
  src?: string;
  text?: string;
  fontFamily?: string;
  strokeColor?: string;
}

export function createSignature(input: CreateSignatureInput): SignatureObject {
  return {
    ...baseObject("signature", input),
    kind: "signature",
    signatureType: input.signatureType,
    src: input.src,
    text: input.text,
    fontFamily: input.fontFamily,
    strokeColor: input.strokeColor,
  };
}

// ----- Redaction ------------------------------------------------------------

export interface CreateRedactionInput extends BaseInput {
  fillColor?: string;
  removeUnderlying?: boolean;
}

export function createRedaction(input: CreateRedactionInput): RedactionObject {
  return {
    ...baseObject("redaction", input),
    kind: "redaction",
    fillColor: input.fillColor ?? "#000000",
    removeUnderlying: input.removeUnderlying ?? true,
  };
}

// ----- OCR ------------------------------------------------------------------

export interface CreateOCRInput {
  pageId: PageId;
  engine?: string;
  language?: string;
  words: OCRLayer["words"];
  metadata?: Record<string, unknown>;
}

export function createOCRLayer(input: CreateOCRInput): OCRLayer {
  const ts = now();
  return {
    id: newId("ocr"),
    pageId: input.pageId,
    engine: input.engine ?? "tesseract.js",
    language: input.language ?? "eng",
    words: input.words,
    createdAt: ts,
    updatedAt: ts,
    metadata: input.metadata ?? {},
  };
}

// ----- Page -----------------------------------------------------------------

export interface CreatePageInput {
  size: PageSize;
  rotation?: number;
  sourcePageIndex?: number | null;
  id?: PageId;
  metadata?: Record<string, unknown>;
}

export function createPage(input: CreatePageInput): PDFPageModel {
  const ts = now();
  return {
    id: input.id ?? newPageId(),
    size: input.size,
    rotation: input.rotation ?? 0,
    sourcePageIndex: input.sourcePageIndex ?? null,
    createdAt: ts,
    updatedAt: ts,
    metadata: input.metadata ?? {},
  };
}

// ----- Document -------------------------------------------------------------

export interface CreateDocumentInput {
  title?: string;
  fileName?: string;
  id?: string;
  pages?: PDFPageModel[];
  pdfFingerprint?: string;
  author?: string;
  producer?: string;
  metadata?: Record<string, unknown>;
}

/** Build an empty, valid normalized document state (optionally with pages). */
export function createDocument(input: CreateDocumentInput = {}): DocumentState {
  const ts = now();
  const meta: DocumentMeta = {
    id: input.id ?? newDocumentId(),
    title: input.title ?? "Untitled",
    fileName: input.fileName ?? "document.pdf",
    schemaVersion: SCHEMA_VERSION,
    createdAt: ts,
    updatedAt: ts,
    pdfFingerprint: input.pdfFingerprint,
    author: input.author,
    producer: input.producer,
    metadata: input.metadata ?? {},
  };

  const pages = input.pages ?? [];
  const pagesMap: Record<PageId, PDFPageModel> = {};
  const objectsByPage: Record<PageId, Record<string, EditableObject>> = {};
  const objectOrder: Record<PageId, string[]> = {};
  const ocrLayers: Record<PageId, OCRLayer | undefined> = {};
  for (const page of pages) {
    pagesMap[page.id] = page;
    objectsByPage[page.id] = {};
    objectOrder[page.id] = [];
    ocrLayers[page.id] = undefined;
  }

  return {
    meta,
    pageOrder: pages.map((p) => p.id),
    pages: pagesMap,
    objectsByPage,
    objectOrder,
    ocrLayers,
  };
}

// ----- Revision -------------------------------------------------------------

export interface CreateRevisionInput {
  label: string;
  snapshot: DocumentState;
  author?: ActorId;
  patchId?: string;
  metadata?: Record<string, unknown>;
}

/** Wrap a full document snapshot as a named, restorable revision. */
export function createRevision(input: CreateRevisionInput): Revision {
  return {
    id: newRevisionId(),
    label: input.label,
    timestamp: now(),
    schemaVersion: input.snapshot.meta.schemaVersion,
    snapshot: input.snapshot,
    patchId: input.patchId,
    author: input.author,
    metadata: input.metadata ?? {},
  };
}
