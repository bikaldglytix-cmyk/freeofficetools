import type { DocumentId, Matrix, ObjectId, PageId, Rect } from "@/lib/pdf/editor/model/types";

export type AnnotationId = ObjectId;

export type AnnotationType =
  | "highlight"
  | "comment"
  | "sticky-note"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "drawing"
  | "signature"
  | "stamp";

export type AnnotationTool =
  | "select"
  | "highlight"
  | "draw"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "comment"
  | "sticky-note"
  | "signature"
  | "stamp";

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface Quad {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export interface ExportMetadata {
  flatten: boolean;
  printable: boolean;
  pdfSubtype: string;
  renderingIntent: "screen" | "print" | "screen-and-print";
  instructions: Record<string, unknown>;
}

export interface AnnotationThreadReply {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  resolved?: boolean;
}

export interface AnnotationThread {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  replies: AnnotationThreadReply[];
  resolved: boolean;
}

export interface BaseAnnotation {
  id: AnnotationId;
  documentId: DocumentId;
  pageId: PageId;
  type: AnnotationType;
  author: string;
  createdAt: number;
  updatedAt: number;
  bounds: Rect;
  transforms: {
    rotation: number;
    matrix: Matrix;
  };
  zIndex: number;
  locked: boolean;
  visible: boolean;
  metadata: Record<string, unknown>;
  export: ExportMetadata;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  color: string;
  opacity: number;
  quads: Quad[];
  text: string;
  selection?: {
    anchorOffset: number;
    focusOffset: number;
  };
}

export interface CommentAnnotation extends BaseAnnotation {
  type: "comment";
  color: string;
  thread: AnnotationThread;
}

export interface StickyNoteAnnotation extends BaseAnnotation {
  type: "sticky-note";
  color: string;
  icon: "note" | "comment" | "help" | "insert";
  thread: AnnotationThread;
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
}

export interface CircleAnnotation extends BaseAnnotation {
  type: "circle";
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: "line";
  stroke: string;
  strokeWidth: number;
  points: [Point, Point];
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  stroke: string;
  strokeWidth: number;
  points: [Point, Point];
  arrowHeadSize: number;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: "drawing";
  stroke: string;
  strokeWidth: number;
  opacity: number;
  paths: Point[][];
  smoothing: number;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: "signature";
  mode: "draw" | "typed" | "image";
  stroke: string;
  text?: string;
  fontFamily?: string;
  src?: string;
  paths?: Point[][];
}

export interface StampAnnotation extends BaseAnnotation {
  type: "stamp";
  label: string;
  color: string;
  preset?: "approved" | "draft" | "rejected" | "confidential" | "custom";
}

export type PdfAnnotation =
  | HighlightAnnotation
  | CommentAnnotation
  | StickyNoteAnnotation
  | RectangleAnnotation
  | CircleAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | DrawingAnnotation
  | SignatureAnnotation
  | StampAnnotation;

export interface AnnotationStyle {
  color: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
}

export interface AnnotationCreationContext {
  documentId: DocumentId;
  pageId: PageId;
  author?: string;
  now?: number;
  zIndex?: number;
}
