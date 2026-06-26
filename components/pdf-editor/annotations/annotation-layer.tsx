"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Ellipse, Group, Label, Layer, Line, Rect, Stage, Tag, Text, Transformer } from "react-konva";
import type Konva from "konva";
import {
  addAnnotationOperation,
  annotationsInRect,
  createCommentAnnotation,
  createDrawingAnnotation,
  createHighlightAnnotation,
  createLineAnnotation,
  createShapeAnnotation,
  createSignatureAnnotation,
  createStampAnnotation,
  createStickyNoteAnnotation,
  editorObjectToAnnotation,
  hitTestAnnotation,
  normalizeRect,
  quadToRect,
  selectionToPageQuads,
  simplifyPath,
  smoothPath,
  toPdfPoint,
  type AnnotationTool,
  type PdfAnnotation,
  type Point,
} from "@/lib/pdf/annotations";
import type { AnnotationObject, EditableObject, PageId, Rect as PdfRect, SignatureObject } from "@/lib/pdf/editor/model/types";
import type { EditOperation } from "@/lib/pdf/editor/operations/types";
import { ops } from "@/lib/pdf/editor/operations/types";
import { documentStore } from "@/lib/pdf/editor/store/document-store";
import { useDispatch, useDocument, usePageObjects, useSelection, useSelectionActions } from "@/lib/pdf/editor/store/hooks";

interface AnnotationLayerProps {
  pageId: PageId | null;
  pageIndex: number;
  width: number;
  height: number;
  zoom: number;
  tool: AnnotationTool;
  pageElement: HTMLElement | null;
}

function AnnotationLayerImpl({ pageId, pageIndex, width, height, zoom, tool, pageElement }: AnnotationLayerProps) {
  const docState = useDocument();
  const objects = usePageObjects(pageId ?? "");
  const dispatch = useDispatch();
  const selection = useSelection();
  const { select, clearSelection } = useSelectionActions();
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef(new Map<string, Konva.Node>());
  const [draft, setDraft] = useState<{ type: AnnotationTool; start: Point; end: Point; path?: Point[] } | null>(null);

  const annotations = useMemo(() => {
    if (!docState) return [];
    return objects
      .filter((object) => object.kind === "annotation" || object.kind === "signature")
      .map((object) => ({ object, annotation: editorObjectToAnnotation(object, docState.meta.id) }));
  }, [docState, objects]);

  const selectedIds = useMemo(() => (selection.pageId === pageId ? selection.ids : []), [pageId, selection.ids, selection.pageId]);

  useEffect(() => {
    const nodes = selectedIds.map((id) => shapeRefs.current.get(id)).filter(Boolean) as Konva.Node[];
    transformerRef.current?.nodes(nodes);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedIds, annotations]);

  useEffect(() => {
    if (tool !== "highlight" || !pageElement || !pageId || !docState) return;
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const mapped = selectionToPageQuads(selection, pageElement, zoom);
      if (!mapped) return;
      dispatch(
        addAnnotationOperation(
          createHighlightAnnotation(
            { documentId: docState.meta.id, pageId, author: docState.meta.author },
            mapped.quads,
            mapped.text,
          ),
        ),
      );
      selection.removeAllRanges();
    };
    window.document.addEventListener("mouseup", onMouseUp);
    return () => window.document.removeEventListener("mouseup", onMouseUp);
  }, [dispatch, docState, pageElement, pageId, tool, zoom]);

  const stagePoint = useCallback((evt: Konva.KonvaEventObject<PointerEvent | MouseEvent>): Point | null => {
    const container = evt.target.getStage()?.container();
    if (!container) return null;
    return toPdfPoint(evt.evt.clientX, evt.evt.clientY, container, zoom);
  }, [zoom]);

  const makeContext = useCallback(() => {
    if (!docState || !pageId) return null;
    return { documentId: docState.meta.id, pageId, author: docState.meta.author };
  }, [docState, pageId]);

  const createText = useCallback((label: string, initial = "") => {
    if (typeof window === "undefined") return initial;
    return window.prompt(label, initial) ?? initial;
  }, []);

  const onPointerDown = useCallback((evt: Konva.KonvaEventObject<PointerEvent>) => {
    if (!pageId) return;
    const point = stagePoint(evt);
    if (!point) return;
    const ctx = makeContext();
    if (!ctx) return;

    if (tool === "select") {
      const hit = hitTestAnnotation(objects, point);
      if (hit) select(pageId, evt.evt.shiftKey ? [...new Set([...selectedIds, hit.id])] : [hit.id]);
      else {
        clearSelection();
        setDraft({ type: "select", start: point, end: point });
      }
      return;
    }

    if (tool === "comment") {
      dispatch(addAnnotationOperation(createCommentAnnotation(ctx, { x: point.x, y: point.y, width: 180, height: 62 }, createText("Comment"))));
      return;
    }
    if (tool === "sticky-note") {
      dispatch(addAnnotationOperation(createStickyNoteAnnotation(ctx, { x: point.x, y: point.y, width: 30, height: 30 }, createText("Sticky note"))));
      return;
    }
    if (tool === "signature") {
      dispatch(addAnnotationOperation(createSignatureAnnotation(ctx, { x: point.x, y: point.y, width: 170, height: 54 }, { mode: "typed", text: createText("Signature", "Signature"), fontFamily: "cursive" })));
      return;
    }
    if (tool === "stamp") {
      dispatch(addAnnotationOperation(createStampAnnotation(ctx, { x: point.x, y: point.y, width: 126, height: 40 }, createText("Stamp", "Approved"))));
      return;
    }

    setDraft({ type: tool, start: point, end: point, path: tool === "draw" ? [point] : undefined });
  }, [clearSelection, createText, dispatch, makeContext, objects, pageId, select, selectedIds, stagePoint, tool]);

  const onPointerMove = useCallback((evt: Konva.KonvaEventObject<PointerEvent>) => {
    if (!draft) return;
    const point = stagePoint(evt);
    if (!point) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            end: point,
            path: current.path ? [...current.path, point] : undefined,
          }
        : null,
    );
  }, [draft, stagePoint]);

  const onPointerUp = useCallback((evt: Konva.KonvaEventObject<PointerEvent>) => {
    if (!draft || !pageId) return;
    const ctx = makeContext();
    if (!ctx) return;
    const end = stagePoint(evt) ?? draft.end;

    if (draft.type === "select") {
      const ids = annotationsInRect(objects, normalizeRect(draft.start, end));
      if (ids.length) select(pageId, ids);
      setDraft(null);
      return;
    }

    if (draft.type === "draw") {
      const path = simplifyPath(smoothPath([...(draft.path ?? []), end]));
      if (path.length > 1) dispatch(addAnnotationOperation(createDrawingAnnotation(ctx, [path])));
      setDraft(null);
      return;
    }

    if (draft.type === "rectangle" || draft.type === "circle") {
      dispatch(addAnnotationOperation(createShapeAnnotation(ctx, draft.type, normalizeRect(draft.start, end))));
    } else if (draft.type === "line" || draft.type === "arrow") {
      dispatch(addAnnotationOperation(createLineAnnotation(ctx, draft.type, [draft.start, end])));
    }
    setDraft(null);
  }, [dispatch, draft, makeContext, objects, pageId, select, stagePoint]);

  const updateRect = useCallback((object: EditableObject, rect: PdfRect, rotation?: number) => {
    if (!pageId || object.locked) return;
    const changes: Partial<EditableObject> = { rect };
    if (rotation !== undefined) changes.rotation = rotation;
    if (object.kind === "signature") {
      dispatch(ops.updateSignature(pageId, object.id, changes as Partial<SignatureObject>));
    } else {
      dispatch(ops.updateAnnotation(pageId, object.id, changes as Partial<AnnotationObject>));
    }
  }, [dispatch, pageId]);

  if (!pageId || !docState) return null;

  const pointerClass = tool === "highlight" ? "pointer-events-none" : "pointer-events-auto";

  return (
    <div className={`absolute inset-0 z-[3] ${pointerClass}`} data-annotation-layer={pageIndex}>
      <Stage
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Layer listening={tool !== "highlight"}>
          {annotations.map(({ object, annotation }) => (
            <AnnotationShape
              key={object.id}
              object={object}
              annotation={annotation}
              selected={selectedIds.includes(object.id)}
              setNode={(node) => {
                if (node) shapeRefs.current.set(object.id, node);
                else shapeRefs.current.delete(object.id);
              }}
              onSelect={() => select(pageId, [object.id])}
              onChange={updateRect}
            />
          ))}
          {draft ? <DraftShape draft={draft} /> : null}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
            boundBoxFunc={(_oldBox, newBox) => ({
              ...newBox,
              width: Math.max(6, newBox.width),
              height: Math.max(6, newBox.height),
            })}
          />
        </Layer>
      </Stage>
    </div>
  );
}

function AnnotationShape({
  object,
  annotation,
  selected,
  setNode,
  onSelect,
  onChange,
}: {
  object: EditableObject;
  annotation: PdfAnnotation;
  selected: boolean;
  setNode: (node: Konva.Node | null) => void;
  onSelect: () => void;
  onChange: (object: EditableObject, rect: PdfRect, rotation?: number) => void;
}) {
  const common = {
    ref: setNode,
    id: object.id,
    x: object.rect.x,
    y: object.rect.y,
    width: object.rect.width,
    height: object.rect.height,
    rotation: object.rotation,
    opacity: object.opacity,
    visible: object.visible,
    draggable: !object.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (evt: Konva.KonvaEventObject<DragEvent>) => {
      onChange(object, { ...object.rect, x: evt.target.x(), y: evt.target.y() });
    },
    onTransformEnd: (evt: Konva.KonvaEventObject<Event>) => {
      const node = evt.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange(
        object,
        {
          x: node.x(),
          y: node.y(),
          width: Math.max(6, object.rect.width * scaleX),
          height: Math.max(6, object.rect.height * scaleY),
        },
        node.rotation(),
      );
    },
    shadowColor: selected ? "#2563eb" : undefined,
    shadowBlur: selected ? 8 : 0,
  };

  switch (annotation.type) {
    case "highlight":
      return (
        <Group {...common}>
          {annotation.quads.map((q, i) => {
            const rect = quadToRect(q);
            return <Rect key={i} x={rect.x - object.rect.x} y={rect.y - object.rect.y} width={rect.width} height={rect.height} fill={annotation.color} opacity={annotation.opacity} />;
          })}
        </Group>
      );
    case "drawing":
      return (
        <Group {...common}>
          {annotation.paths.map((path, i) => (
            <Line key={i} points={path.flatMap((p) => [p.x - object.rect.x, p.y - object.rect.y])} stroke={annotation.stroke} strokeWidth={annotation.strokeWidth} lineCap="round" lineJoin="round" tension={0.35} />
          ))}
        </Group>
      );
    case "circle":
      return <Ellipse {...common} x={object.rect.x + object.rect.width / 2} y={object.rect.y + object.rect.height / 2} radiusX={object.rect.width / 2} radiusY={object.rect.height / 2} stroke={annotation.stroke} fill={annotation.fill} strokeWidth={annotation.strokeWidth} />;
    case "line":
      return <Line {...common} x={0} y={0} points={annotation.points.flatMap((p) => [p.x, p.y])} stroke={annotation.stroke} strokeWidth={annotation.strokeWidth} lineCap="round" />;
    case "arrow":
      return <Arrow {...common} x={0} y={0} points={annotation.points.flatMap((p) => [p.x, p.y])} stroke={annotation.stroke} fill={annotation.stroke} strokeWidth={annotation.strokeWidth} pointerLength={annotation.arrowHeadSize} pointerWidth={annotation.arrowHeadSize} />;
    case "comment":
      return (
        <Label {...common}>
          <Tag fill={annotation.color} cornerRadius={4} opacity={0.9} />
          <Text text={annotation.thread.body || "Comment"} fill="#fff" padding={8} width={object.rect.width} height={object.rect.height} fontSize={12} />
        </Label>
      );
    case "sticky-note":
      return (
        <Group {...common}>
          <Rect width={object.rect.width} height={object.rect.height} fill={annotation.color} cornerRadius={4} />
          <Text text="!" fill="#fff" fontStyle="bold" align="center" verticalAlign="middle" width={object.rect.width} height={object.rect.height} />
        </Group>
      );
    case "signature":
      return <Text {...common} text={annotation.text ?? "Signature"} fontFamily={annotation.fontFamily ?? "cursive"} fontSize={Math.max(18, object.rect.height * 0.55)} fill={annotation.stroke} />;
    case "stamp":
      return (
        <Group {...common}>
          <Rect width={object.rect.width} height={object.rect.height} stroke={annotation.color} strokeWidth={2} cornerRadius={4} />
          <Text text={annotation.label.toUpperCase()} fill={annotation.color} fontStyle="bold" align="center" verticalAlign="middle" width={object.rect.width} height={object.rect.height} fontSize={14} />
        </Group>
      );
    default:
      return <Rect {...common} stroke={(annotation as { stroke?: string }).stroke ?? "#2563eb"} fill={(annotation as { fill?: string }).fill ?? "transparent"} strokeWidth={(annotation as { strokeWidth?: number }).strokeWidth ?? 2} />;
  }
}

function DraftShape({ draft }: { draft: { type: AnnotationTool; start: Point; end: Point; path?: Point[] } }) {
  const rect = normalizeRect(draft.start, draft.end);
  if (draft.type === "draw" && draft.path) {
    return <Line points={draft.path.flatMap((p) => [p.x, p.y])} stroke="#111827" strokeWidth={2} lineCap="round" lineJoin="round" opacity={0.75} />;
  }
  if (draft.type === "line") {
    return <Line points={[draft.start.x, draft.start.y, draft.end.x, draft.end.y]} stroke="#dc2626" strokeWidth={2} />;
  }
  if (draft.type === "arrow") {
    return <Arrow points={[draft.start.x, draft.start.y, draft.end.x, draft.end.y]} stroke="#dc2626" fill="#dc2626" strokeWidth={2} pointerLength={10} pointerWidth={10} />;
  }
  if (draft.type === "circle") {
    return <Ellipse x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} radiusX={rect.width / 2} radiusY={rect.height / 2} stroke="#2563eb" fill="rgba(37,99,235,0.08)" strokeWidth={2} dash={[5, 4]} />;
  }
  return <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} stroke="#2563eb" fill="rgba(37,99,235,0.08)" strokeWidth={2} dash={[5, 4]} />;
}

export const AnnotationLayer = memo(AnnotationLayerImpl);

export function deleteSelectedAnnotations() {
  const state = documentStore.getState();
  const pageId = state.selection.pageId;
  if (!pageId || state.selection.ids.length === 0 || !state.document) return;
  const objects = state.document.objectsByPage[pageId] ?? {};
  const operations: EditOperation[] = state.selection.ids
    .map((id) => {
      const object = objects[id];
      if (!object) return null;
      return object.kind === "signature" ? ops.removeSignature(pageId, id) : ops.deleteAnnotation(pageId, id);
    })
    .filter((op): op is EditOperation => op !== null);
  state.dispatchAll(operations, "Delete annotations");
  state.clearSelection();
}
