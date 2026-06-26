import { IDENTITY_MATRIX, type AnnotationObject, type Rect, type SignatureObject } from "@/lib/pdf/editor/model/types";
import { newId, newObjectId } from "@/lib/pdf/editor/model/ids";
import { createAnnotation, createSignature } from "@/lib/pdf/editor/model/factory";
import { quadsToBounds, rectToQuad } from "./geometry";
import type {
  AnnotationCreationContext,
  AnnotationThread,
  BaseAnnotation,
  PdfAnnotation,
  Point,
  Quad,
} from "./types";

const DEFAULT_AUTHOR = "Anonymous";

function base(ctx: AnnotationCreationContext, type: PdfAnnotation["type"], bounds: Rect): BaseAnnotation {
  const ts = ctx.now ?? Date.now();
  return {
    id: newObjectId(),
    documentId: ctx.documentId,
    pageId: ctx.pageId,
    type,
    author: ctx.author ?? DEFAULT_AUTHOR,
    createdAt: ts,
    updatedAt: ts,
    bounds,
    transforms: { rotation: 0, matrix: IDENTITY_MATRIX },
    zIndex: ctx.zIndex ?? ts,
    locked: false,
    visible: true,
    metadata: {},
    export: {
      flatten: true,
      printable: true,
      pdfSubtype: pdfSubtypeFor(type),
      renderingIntent: "screen-and-print",
      instructions: {},
    },
  };
}

function thread(author: string, body = ""): AnnotationThread {
  const ts = Date.now();
  return { id: newId("thread"), author, body, createdAt: ts, updatedAt: ts, replies: [], resolved: false };
}

function pdfSubtypeFor(type: PdfAnnotation["type"]): string {
  switch (type) {
    case "highlight":
      return "Highlight";
    case "comment":
    case "sticky-note":
      return "Text";
    case "drawing":
      return "Ink";
    case "signature":
      return "Widget";
    case "stamp":
      return "Stamp";
    default:
      return "Square";
  }
}

export function createHighlightAnnotation(
  ctx: AnnotationCreationContext,
  quads: Quad[],
  text = "",
  color = "#ffd400",
): PdfAnnotation {
  return {
    ...base(ctx, "highlight", quadsToBounds(quads)),
    type: "highlight",
    color,
    opacity: 0.35,
    quads,
    text,
  };
}

export function createShapeAnnotation(
  ctx: AnnotationCreationContext,
  type: "rectangle" | "circle",
  bounds: Rect,
  style = { stroke: "#2563eb", fill: "rgba(37,99,235,0.08)", strokeWidth: 2, opacity: 1 },
): PdfAnnotation {
  return { ...base(ctx, type, bounds), type, ...style };
}

export function createLineAnnotation(
  ctx: AnnotationCreationContext,
  type: "line" | "arrow",
  points: [Point, Point],
  stroke = "#dc2626",
): PdfAnnotation {
  const bounds = {
    x: Math.min(points[0].x, points[1].x),
    y: Math.min(points[0].y, points[1].y),
    width: Math.max(4, Math.abs(points[1].x - points[0].x)),
    height: Math.max(4, Math.abs(points[1].y - points[0].y)),
  };
  return type === "arrow"
    ? { ...base(ctx, "arrow", bounds), type: "arrow", stroke, strokeWidth: 2, points, arrowHeadSize: 10 }
    : { ...base(ctx, "line", bounds), type: "line", stroke, strokeWidth: 2, points };
}

export function createDrawingAnnotation(ctx: AnnotationCreationContext, paths: Point[][], stroke = "#111827"): PdfAnnotation {
  const points = paths.flat();
  const bounds = points.length
    ? {
        x: Math.min(...points.map((p) => p.x)),
        y: Math.min(...points.map((p) => p.y)),
        width: Math.max(4, Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))),
        height: Math.max(4, Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))),
      }
    : { x: 0, y: 0, width: 4, height: 4 };
  return { ...base(ctx, "drawing", bounds), type: "drawing", stroke, strokeWidth: 2, opacity: 1, paths, smoothing: 0.35 };
}

export function createCommentAnnotation(ctx: AnnotationCreationContext, bounds: Rect, body = ""): PdfAnnotation {
  const b = base(ctx, "comment", bounds);
  return { ...b, type: "comment", color: "#0ea5e9", thread: thread(b.author, body) };
}

export function createStickyNoteAnnotation(ctx: AnnotationCreationContext, bounds: Rect, body = ""): PdfAnnotation {
  const b = base(ctx, "sticky-note", bounds);
  return { ...b, type: "sticky-note", color: "#f59e0b", icon: "note", thread: thread(b.author, body) };
}

export function createSignatureAnnotation(
  ctx: AnnotationCreationContext,
  bounds: Rect,
  signature: { mode: "draw" | "typed" | "image"; text?: string; src?: string; paths?: Point[][]; fontFamily?: string },
): PdfAnnotation {
  return { ...base(ctx, "signature", bounds), type: "signature", stroke: "#111827", ...signature };
}

export function createStampAnnotation(ctx: AnnotationCreationContext, bounds: Rect, label = "Approved"): PdfAnnotation {
  return { ...base(ctx, "stamp", bounds), type: "stamp", label, color: "#059669", preset: label.toLowerCase() as never };
}

export function annotationToEditorObject(annotation: PdfAnnotation): AnnotationObject | SignatureObject {
  if (annotation.type === "signature") {
    return withAnnotationBase(annotation, createSignature({
      pageId: annotation.pageId,
      rect: annotation.bounds,
      zIndex: annotation.zIndex,
      rotation: annotation.transforms.rotation,
      actor: annotation.author,
      metadata: { annotation },
      signatureType: annotation.mode,
      src: annotation.src,
      text: annotation.text,
      fontFamily: annotation.fontFamily,
      strokeColor: annotation.stroke,
    }));
  }

  const common = {
    pageId: annotation.pageId,
    rect: annotation.bounds,
    zIndex: annotation.zIndex,
    rotation: annotation.transforms.rotation,
    actor: annotation.author,
    metadata: { annotation },
  };

  switch (annotation.type) {
    case "highlight":
      return withAnnotationBase(annotation, createAnnotation({
        ...common,
        annotationType: "highlight",
        color: annotation.color,
        fill: annotation.color,
        quadPoints: annotation.quads.flatMap((q) => [q.x1, q.y1, q.x2, q.y2, q.x3, q.y3, q.x4, q.y4]),
        text: annotation.text,
      }));
    case "comment":
    case "sticky-note":
      return withAnnotationBase(annotation, createAnnotation({ ...common, annotationType: "note", color: annotation.color, text: annotation.thread.body }));
    case "drawing":
      return withAnnotationBase(annotation, createAnnotation({
        ...common,
        annotationType: "ink",
        color: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        points: annotation.paths.flatMap((path) => path.flatMap((p) => [p.x, p.y])),
      }));
    case "rectangle":
      return withAnnotationBase(annotation, createAnnotation({ ...common, annotationType: "shape", shape: "rectangle", color: annotation.stroke, fill: annotation.fill, strokeWidth: annotation.strokeWidth }));
    case "circle":
      return withAnnotationBase(annotation, createAnnotation({ ...common, annotationType: "shape", shape: "ellipse", color: annotation.stroke, fill: annotation.fill, strokeWidth: annotation.strokeWidth }));
    case "line":
    case "arrow":
      return withAnnotationBase(annotation, createAnnotation({
        ...common,
        annotationType: "shape",
        shape: annotation.type,
        color: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        points: annotation.points.flatMap((p) => [p.x, p.y]),
      }));
    case "stamp":
      return withAnnotationBase(annotation, createAnnotation({ ...common, annotationType: "stamp", color: annotation.color, text: annotation.label }));
  }
}

function withAnnotationBase<T extends AnnotationObject | SignatureObject>(annotation: PdfAnnotation, object: T): T {
  return {
    ...object,
    id: annotation.id,
    rect: annotation.bounds,
    rotation: annotation.transforms.rotation,
    transform: annotation.transforms.matrix,
    zIndex: annotation.zIndex,
    locked: annotation.locked,
    visible: annotation.visible,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
    createdBy: annotation.author,
    updatedBy: annotation.author,
    metadata: { ...object.metadata, annotation },
  };
}

export function editorObjectToAnnotation(object: AnnotationObject | SignatureObject, documentId: string): PdfAnnotation {
  const stored = object.metadata.annotation;
  if (stored && typeof stored === "object") return stored as PdfAnnotation;
  const ctx = { documentId, pageId: object.pageId, author: object.createdBy, now: object.createdAt, zIndex: object.zIndex };
  if (object.kind === "signature") {
    return createSignatureAnnotation(ctx, object.rect, {
      mode: object.signatureType,
      src: object.src,
      text: object.text,
      fontFamily: object.fontFamily,
    });
  }
  if (object.annotationType === "highlight") {
    const nums = object.quadPoints ?? [];
    const quads = nums.length >= 8
      ? chunks(nums, 8).map((q) => ({ x1: q[0], y1: q[1], x2: q[2], y2: q[3], x3: q[4], y3: q[5], x4: q[6], y4: q[7] }))
      : [rectToQuad(object.rect)];
    return createHighlightAnnotation(ctx, quads, object.text, object.color);
  }
  return createShapeAnnotation(ctx, object.shape === "ellipse" ? "circle" : "rectangle", object.rect);
}

function chunks(values: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
