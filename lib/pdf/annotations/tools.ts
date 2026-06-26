import type { StoreApi } from "zustand/vanilla";
import type { DocumentStore } from "@/lib/pdf/editor/store/types";
import type { PageId, Rect } from "@/lib/pdf/editor/model/types";
import {
  createCommentAnnotation,
  createDrawingAnnotation,
  createHighlightAnnotation,
  createLineAnnotation,
  createShapeAnnotation,
  createSignatureAnnotation,
  createStampAnnotation,
  createStickyNoteAnnotation,
} from "./factory";
import { normalizeRect, rectToQuad } from "./geometry";
import { addAnnotationOperation } from "./operations";
import { simplifyPath, smoothPath } from "./drawing";
import type { AnnotationTool, Point, Quad } from "./types";

export interface AnnotationPointerEvent {
  pageId: PageId;
  point: Point;
  shiftKey?: boolean;
  altKey?: boolean;
  targetId?: string;
  pageElement?: HTMLElement;
  selectionQuads?: Quad[];
  selectionText?: string;
}

export interface AnnotationToolContext {
  documentId: string;
  author?: string;
  store: StoreApi<DocumentStore>;
  requestText?: (initial: string, label: string) => Promise<string | null>;
}

export interface AnnotationToolController {
  readonly id: AnnotationTool;
  activate(): void;
  deactivate(): void;
  onPointerDown(event: AnnotationPointerEvent): void;
  onPointerMove(event: AnnotationPointerEvent): void;
  onPointerUp(event: AnnotationPointerEvent): void;
  cancel(): void;
}

abstract class BaseTool implements AnnotationToolController {
  protected start: AnnotationPointerEvent | null = null;

  constructor(
    public readonly id: AnnotationTool,
    protected readonly ctx: AnnotationToolContext,
  ) {}

  activate(): void {}
  deactivate(): void {
    this.cancel();
  }
  onPointerDown(event: AnnotationPointerEvent): void {
    this.start = event;
  }
  onPointerMove(event: AnnotationPointerEvent): void {
    void event;
  }
  onPointerUp(event: AnnotationPointerEvent): void {
    void event;
    this.start = null;
  }
  cancel(): void {
    this.start = null;
  }

  protected creation(pageId: PageId) {
    return { documentId: this.ctx.documentId, pageId, author: this.ctx.author };
  }

  protected dispatch(annotation: Parameters<typeof addAnnotationOperation>[0]) {
    this.ctx.store.getState().dispatch(addAnnotationOperation(annotation));
  }
}

export class SelectTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("select", ctx);
  }

  override onPointerDown(event: AnnotationPointerEvent): void {
    if (event.targetId) this.ctx.store.getState().select(event.pageId, [event.targetId]);
    else this.ctx.store.getState().clearSelection();
  }
}

export class HighlightTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("highlight", ctx);
  }

  override onPointerUp(event: AnnotationPointerEvent): void {
    const quads = event.selectionQuads?.length ? event.selectionQuads : this.start ? [rectToQuad(normalizeRect(this.start.point, event.point))] : [];
    if (quads.length) this.dispatch(createHighlightAnnotation(this.creation(event.pageId), quads, event.selectionText ?? ""));
    this.start = null;
  }
}

export class DrawTool extends BaseTool {
  private points: Point[] = [];

  constructor(ctx: AnnotationToolContext) {
    super("draw", ctx);
  }

  override onPointerDown(event: AnnotationPointerEvent): void {
    super.onPointerDown(event);
    this.points = [event.point];
  }

  override onPointerMove(event: AnnotationPointerEvent): void {
    if (!this.start) return;
    this.points.push(event.point);
  }

  override onPointerUp(event: AnnotationPointerEvent): void {
    if (!this.start) return;
    this.points.push(event.point);
    const path = simplifyPath(smoothPath(this.points));
    if (path.length > 1) this.dispatch(createDrawingAnnotation(this.creation(event.pageId), [path]));
    this.points = [];
    this.start = null;
  }

  override cancel(): void {
    super.cancel();
    this.points = [];
  }
}

abstract class RectTool extends BaseTool {
  constructor(id: "rectangle" | "circle", ctx: AnnotationToolContext) {
    super(id, ctx);
  }

  override onPointerUp(event: AnnotationPointerEvent): void {
    if (!this.start) return;
    this.dispatch(createShapeAnnotation(this.creation(event.pageId), this.id as "rectangle" | "circle", normalizeRect(this.start.point, event.point)));
    this.start = null;
  }
}

export class RectangleTool extends RectTool {
  constructor(ctx: AnnotationToolContext) {
    super("rectangle", ctx);
  }
}

export class CircleTool extends RectTool {
  constructor(ctx: AnnotationToolContext) {
    super("circle", ctx);
  }
}

abstract class SegmentTool extends BaseTool {
  constructor(id: "line" | "arrow", ctx: AnnotationToolContext) {
    super(id, ctx);
  }

  override onPointerUp(event: AnnotationPointerEvent): void {
    if (!this.start) return;
    this.dispatch(createLineAnnotation(this.creation(event.pageId), this.id as "line" | "arrow", [this.start.point, event.point]));
    this.start = null;
  }
}

export class LineTool extends SegmentTool {
  constructor(ctx: AnnotationToolContext) {
    super("line", ctx);
  }
}

export class ArrowTool extends SegmentTool {
  constructor(ctx: AnnotationToolContext) {
    super("arrow", ctx);
  }
}

export class CommentTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("comment", ctx);
  }

  override async onPointerUp(event: AnnotationPointerEvent): Promise<void> {
    const body = (await this.ctx.requestText?.("", "Comment")) ?? "";
    const rect: Rect = { x: event.point.x, y: event.point.y, width: 160, height: 56 };
    this.dispatch(createCommentAnnotation(this.creation(event.pageId), rect, body));
    this.start = null;
  }
}

export class StickyNoteTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("sticky-note", ctx);
  }

  override async onPointerUp(event: AnnotationPointerEvent): Promise<void> {
    const body = (await this.ctx.requestText?.("", "Sticky note")) ?? "";
    this.dispatch(createStickyNoteAnnotation(this.creation(event.pageId), { x: event.point.x, y: event.point.y, width: 28, height: 28 }, body));
    this.start = null;
  }
}

export class SignatureTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("signature", ctx);
  }

  override async onPointerUp(event: AnnotationPointerEvent): Promise<void> {
    const text = (await this.ctx.requestText?.("Signature", "Signature")) ?? "Signature";
    this.dispatch(
      createSignatureAnnotation(this.creation(event.pageId), { x: event.point.x, y: event.point.y, width: 160, height: 48 }, { mode: "typed", text, fontFamily: "cursive" }),
    );
    this.start = null;
  }
}

export class StampTool extends BaseTool {
  constructor(ctx: AnnotationToolContext) {
    super("stamp", ctx);
  }

  override onPointerUp(event: AnnotationPointerEvent): void {
    this.dispatch(createStampAnnotation(this.creation(event.pageId), { x: event.point.x, y: event.point.y, width: 120, height: 38 }, "Approved"));
    this.start = null;
  }
}

export function createAnnotationTool(id: AnnotationTool, ctx: AnnotationToolContext): AnnotationToolController {
  switch (id) {
    case "select":
      return new SelectTool(ctx);
    case "highlight":
      return new HighlightTool(ctx);
    case "draw":
      return new DrawTool(ctx);
    case "rectangle":
      return new RectangleTool(ctx);
    case "circle":
      return new CircleTool(ctx);
    case "line":
      return new LineTool(ctx);
    case "arrow":
      return new ArrowTool(ctx);
    case "comment":
      return new CommentTool(ctx);
    case "sticky-note":
      return new StickyNoteTool(ctx);
    case "signature":
      return new SignatureTool(ctx);
    case "stamp":
      return new StampTool(ctx);
  }
}
