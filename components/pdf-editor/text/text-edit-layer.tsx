"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { EditableObject, PageId, Rect, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { ops } from "@/lib/pdf/editor/operations/types";
import { documentStore } from "@/lib/pdf/editor/store/document-store";
import { useDispatch, useDocument, usePageObjects, useSelection, useSelectionActions } from "@/lib/pdf/editor/store/hooks";
import { clampRect, clientPointToPdfPoint, type Point } from "@/lib/pdf/text/geometry";
import {
  createAddedTextOperation,
  createReplacementTextOperation,
  styleTextOperation,
  updateTextContentOperation,
} from "@/lib/pdf/text/operations";
import type { TextBlock as NativeTextBlock, TextStyle } from "@/lib/pdf/text/types";
import { useTextExtraction } from "./use-text-extraction";
import { TextBlockEditor } from "./text-block-editor";

export type TextTool = "off" | "select" | "add";

interface TextEditLayerProps {
  pageId: PageId | null;
  pageIndex: number;
  page: PDFPageProxy | null;
  width: number;
  height: number;
  zoom: number;
  tool: TextTool;
  pageElement: HTMLElement | null;
}

function isTextObject(o: EditableObject): o is EditorTextBlock {
  return o.kind === "text";
}

/** The original-text rectangles an edited block must paint white in the editor. */
function whiteoutBounds(object: EditorTextBlock): Rect[] {
  const exp = object.metadata?.export as { whiteout?: { bounds?: Rect[] } } | undefined;
  return exp?.whiteout?.bounds ?? [];
}

function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * The text-editing overlay for one page. It mirrors `AnnotationLayer`: a
 * positioned layer over the page canvas, reading/writing the Phase 2 store.
 *
 * Three classes of content live here:
 *   1. **Native blocks** (from PDF.js extraction) — shown as click targets in
 *      "select" mode. Editing one dispatches a whiteout/restamp replacement.
 *   2. **Store text objects** (added or already-edited) — rendered editable via
 *      {@link TextBlockEditor}; native ones also paint a whiteout preview so the
 *      canvas text beneath is hidden, matching what the export engine will do.
 *   3. **In-flight UI** — the add-text marquee and the native inline editor.
 */
export function TextEditLayer({ pageId, pageIndex, page, width, height, zoom, tool, pageElement }: TextEditLayerProps) {
  const docState = useDocument();
  const objects = usePageObjects(pageId ?? "");
  const dispatch = useDispatch();
  const selection = useSelection();
  const { select, clearSelection } = useSelectionActions();

  const documentId = docState?.meta.id ?? null;
  const enabled = tool !== "off";

  const { extracted } = useTextExtraction({ page, documentId, pageId, pageIndex, enabled });

  const textObjects = useMemo(() => objects.filter(isTextObject), [objects]);

  // pdf.js item ids already replaced by a store object — used to hide the
  // corresponding native block so the same text never shows twice.
  const replacedItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const o of textObjects) {
      if (o.source === "original" && o.originalItemIds) for (const id of o.originalItemIds) set.add(id);
    }
    return set;
  }, [textObjects]);

  const nativeBlocks = useMemo(() => {
    if (!extracted) return [];
    return extracted.blocks.filter(
      (b) => b.provenance.kind === "native" && !b.provenance.pdfItemIds.some((id) => replacedItemIds.has(id)),
    );
  }, [extracted, replacedItemIds]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nativeEdit, setNativeEdit] = useState<NativeTextBlock | null>(null);
  const [draft, setDraft] = useState<{ start: Point; end: Point } | null>(null);
  const draftRef = useRef<{ start: Point; end: Point } | null>(null);
  // Mirror draft into a ref for the pointer handlers, written after render.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const selectedIds = useMemo(
    () => (selection.pageId === pageId ? selection.ids : []),
    [pageId, selection.ids, selection.pageId],
  );

  const toPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!pageElement) return null;
      return clientPointToPdfPoint(clientX, clientY, pageElement, zoom);
    },
    [pageElement, zoom],
  );

  const commitObjectText = useCallback(
    (object: EditorTextBlock, text: string) => {
      setEditingId(null);
      if (!pageId || text === object.text) return;
      dispatch(updateTextContentOperation(pageId, object.id, text));
    },
    [dispatch, pageId],
  );

  const commitNativeEdit = useCallback(
    (text: string) => {
      const block = nativeEdit;
      setNativeEdit(null);
      if (!block || !pageId || text === block.text) return;
      const op = createReplacementTextOperation({ source: block, text });
      dispatch(op);
      if (op.type === "ADD_TEXT") select(pageId, [op.object.id]);
    },
    [dispatch, nativeEdit, pageId, select],
  );

  // Empty-area pointer down: clear selection (select) or drag a new box (add).
  const onRootPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled || !pageId || !docState) return;
      const point = toPoint(e.clientX, e.clientY);
      if (!point) return;
      setEditingId(null);
      if (tool === "select") {
        clearSelection();
        return;
      }
      setDraft({ start: point, end: point });
      const onMove = (ev: globalThis.PointerEvent) => {
        const p = toPoint(ev.clientX, ev.clientY);
        if (p) setDraft((d) => (d ? { start: d.start, end: p } : d));
      };
      const onUp = (ev: globalThis.PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const d = draftRef.current;
        setDraft(null);
        if (!d) return;
        const end = toPoint(ev.clientX, ev.clientY) ?? d.end;
        const drawn = normalizeRect(d.start, end);
        const rect = drawn.width < 6 || drawn.height < 6 ? { x: d.start.x, y: d.start.y, width: 200, height: 24 } : drawn;
        const bounded = extracted ? clampRect(rect, { width: extracted.width, height: extracted.height }) : rect;
        const op = createAddedTextOperation({ pageId, rect: bounded, text: "", actor: docState.meta.author });
        dispatch(op);
        if (op.type === "ADD_TEXT") {
          select(pageId, [op.object.id]);
          setEditingId(op.object.id);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clearSelection, dispatch, docState, enabled, extracted, pageId, select, tool, toPoint],
  );

  if (!pageId || !docState) return null;

  const draftRect = draft ? normalizeRect(draft.start, draft.end) : null;

  return (
    <div
      className={`absolute inset-0 z-[4] ${enabled ? "pointer-events-auto" : "pointer-events-none"}`}
      data-text-edit-layer={pageIndex}
      style={{ width, height }}
      onPointerDown={onRootPointerDown}
    >
      {/* Whiteout previews behind edited native text. */}
      {textObjects.flatMap((o) =>
        whiteoutBounds(o).map((b, i) => (
          <div
            key={`${o.id}_wo_${i}`}
            style={{
              position: "absolute",
              left: b.x * zoom,
              top: b.y * zoom,
              width: b.width * zoom,
              height: b.height * zoom,
              background: "#ffffff",
              pointerEvents: "none",
            }}
          />
        )),
      )}

      {/* Native text click targets (select mode only). */}
      {tool === "select"
        ? nativeBlocks.map((b) => (
            <div
              key={b.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                setEditingId(null);
                clearSelection();
                setNativeEdit(b);
              }}
              style={{
                position: "absolute",
                left: b.bounds.x * zoom,
                top: b.bounds.y * zoom,
                width: b.bounds.width * zoom,
                height: b.bounds.height * zoom,
                cursor: "text",
                outline: "1px dashed rgba(37,99,235,0.25)",
              }}
            />
          ))
        : null}

      {/* Store-backed text objects. */}
      {textObjects.map((object) => (
        <TextBlockEditor
          key={object.id}
          object={object}
          zoom={zoom}
          selected={selectedIds.includes(object.id)}
          editing={editingId === object.id}
          interactive={enabled}
          onSelect={(additive) =>
            select(pageId, additive ? [...new Set([...selectedIds, object.id])] : [object.id])
          }
          onStartEdit={() => setEditingId(object.id)}
          onCommit={(text) => commitObjectText(object, text)}
          onCancelEdit={() => setEditingId(null)}
          onTransform={(rect) => dispatch(ops.moveText(pageId, object.id, rect))}
        />
      ))}

      {/* Add-text marquee. */}
      {draftRect ? (
        <div
          style={{
            position: "absolute",
            left: draftRect.x * zoom,
            top: draftRect.y * zoom,
            width: draftRect.width * zoom,
            height: draftRect.height * zoom,
            border: "1.5px dashed var(--primary)",
            background: "rgba(37,99,235,0.06)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Inline editor for a native block (before it becomes a store object). */}
      {nativeEdit ? (
        <textarea
          autoFocus
          defaultValue={nativeEdit.text}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setNativeEdit(null);
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commitNativeEdit((e.target as HTMLTextAreaElement).value);
            }
          }}
          onBlur={(e) => commitNativeEdit(e.target.value)}
          style={{
            position: "absolute",
            left: nativeEdit.bounds.x * zoom,
            top: nativeEdit.bounds.y * zoom,
            width: Math.max(nativeEdit.bounds.width, 40) * zoom,
            height: Math.max(nativeEdit.bounds.height, 16) * zoom,
            fontFamily: nativeEdit.style.font.fallbackFamily,
            fontSize: nativeEdit.style.fontSize * zoom,
            color: nativeEdit.style.color,
            lineHeight: nativeEdit.style.lineHeight,
            border: "none",
            outline: "2px solid var(--primary)",
            background: "rgba(255,255,255,0.96)",
            resize: "none",
            padding: 0,
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Imperative helpers for the toolbar (mirror deleteSelectedAnnotations).
// ---------------------------------------------------------------------------

export function deleteSelectedText(): void {
  const state = documentStore.getState();
  const pageId = state.selection.pageId;
  if (!pageId || !state.document || state.selection.ids.length === 0) return;
  const objects = state.document.objectsByPage[pageId] ?? {};
  const operations = state.selection.ids
    .filter((id) => objects[id]?.kind === "text")
    .map((id) => ops.deleteText(pageId, id));
  if (operations.length === 0) return;
  state.dispatchAll(operations, "Delete text");
  state.clearSelection();
}

export function applyStyleToSelectedText(style: Partial<TextStyle>): void {
  const state = documentStore.getState();
  const pageId = state.selection.pageId;
  if (!pageId || !state.document || state.selection.ids.length === 0) return;
  const objects = state.document.objectsByPage[pageId] ?? {};
  const operations = state.selection.ids
    .filter((id) => objects[id]?.kind === "text")
    .map((id) => styleTextOperation(pageId, id, style));
  if (operations.length === 0) return;
  state.dispatchAll(operations, "Style text");
}
