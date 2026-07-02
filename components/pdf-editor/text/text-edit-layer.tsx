"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { EditableObject, PageId, Rect, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { ops, type EditOperation } from "@/lib/pdf/editor/operations/types";
import { reflowBelowOps } from "@/lib/pdf/editor/model/reflow";
import { documentStore } from "@/lib/pdf/editor/store/document-store";
import { useDispatch, useDispatchAll, useDocument, usePageObjects, useSelection, useSelectionActions } from "@/lib/pdf/editor/store/hooks";
import { rectKey } from "@/lib/pdf/editor/live/redact-page";
import { ensureScreenFonts } from "@/lib/pdf/fonts/register-screen-fonts";
import { fontFamilyStack } from "@/lib/pdf/text/fonts";
import { clampRect, clientPointToPdfPoint, expandRect, pdfToViewportRect, type Point } from "@/lib/pdf/text/geometry";
import { lineBoxHeight } from "@/lib/pdf/text/line-box";
import { caretIndexAtX, measureTextBoxHeight } from "@/lib/pdf/text/measure";
import {
  createAddedTextOperation,
  createReplacementTextOperation,
  styleTextOperation,
  updateTextContentOperation,
} from "@/lib/pdf/text/operations";
import { reflowNativeBelowOps } from "@/lib/pdf/text/reflow-native";
import { runsFromSpans, type RichResult } from "@/lib/pdf/text/rich-runs";
import type { TextBlock as NativeTextBlock, TextStyle } from "@/lib/pdf/text/types";
import { lineMaskRect, storedWhiteoutBounds } from "@/lib/pdf/text/whiteout";
import { sampleBackgroundColor } from "@/lib/pdf/viewer/sample-background";
import { useTextExtraction } from "./use-text-extraction";
import { TextBlockEditor } from "./text-block-editor";
import { RichTextEditor, getActiveRichEditor } from "./rich-text-editor";

/** The largest font size in a block, so the auto-grow box never clips a run that
 *  is bigger than the block default. */
function maxRunFontSize(object: EditorTextBlock): number {
  if (!object.runs || !object.runs.length) return object.fontSize;
  return object.runs.reduce((m, r) => Math.max(m, r.fontSize ?? object.fontSize), object.fontSize);
}

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
  /** Mask rects (by {@link rectKey}) whose original glyphs have been truly
   *  removed from the canvas raster — their masks are dropped entirely. */
  cleanRectKeys: ReadonlySet<string>;
  /** Publishes the ink rect of the line being edited inline, so the page can
   *  remove its glyphs from the canvas while the user is still typing. */
  onLiveEditRect: (rect: Rect | null) => void;
  /** Bumped by the page after each canvas paint; triggers mask-colour sampling. */
  paintVersion: number;
}

function isTextObject(o: EditableObject): o is EditorTextBlock {
  return o.kind === "text";
}

/**
 * Editing granularity: split a reconstructed paragraph block into one editable
 * target *per visual line*, so clicking edits just that line instead of the
 * whole paragraph. Each line becomes a self-contained single-line native block
 * carrying only its own glyph ids + bounds + style, so the whiteout/restamp and
 * content-stream redaction touch only the edited line and leave its neighbours
 * untouched and still extractable.
 */
function blockToLineBlocks(block: NativeTextBlock): NativeTextBlock[] {
  if (block.provenance.kind !== "native" || block.lines.length <= 1) return [block];
  return block.lines.map((line) => ({
    ...block,
    id: line.id,
    text: line.text.trimEnd(),
    bounds: line.bounds,
    lines: [line],
    style: line.spans[0]?.style ?? block.style,
    provenance: {
      kind: "native",
      pdfItemIds: line.spans.flatMap((span) => span.runs.map((run) => run.id)),
      confidence: 1,
      editable: "overlay-replacement",
    },
  }));
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
export function TextEditLayer({
  pageId,
  pageIndex,
  page,
  width,
  height,
  zoom,
  tool,
  pageElement,
  cleanRectKeys,
  onLiveEditRect,
  paintVersion,
}: TextEditLayerProps) {
  const docState = useDocument();
  const objects = usePageObjects(pageId ?? "");
  const dispatch = useDispatch();
  const dispatchAll = useDispatchAll();
  const selection = useSelection();
  const { select, clearSelection } = useSelectionActions();

  const documentId = docState?.meta.id ?? null;
  const enabled = tool !== "off";

  const { extracted } = useTextExtraction({ page, documentId, pageId, pageIndex, enabled });

  // Make the bundled faces resolvable on screen so measurement, the inline
  // editors and the export engine all use the same metrics.
  useEffect(() => {
    if (enabled) ensureScreenFonts();
  }, [enabled]);

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

  // One editable target per visual line. A line is hidden once a store object
  // has replaced its glyphs, so only the still-original lines stay clickable.
  const nativeLines = useMemo(() => {
    if (!extracted) return [];
    return extracted.blocks
      .filter((b) => b.provenance.kind === "native")
      .flatMap(blockToLineBlocks)
      .filter(
        (line) =>
          line.provenance.kind === "native" &&
          !line.provenance.pdfItemIds.some((id) => replacedItemIds.has(id)),
      );
  }, [extracted, replacedItemIds]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nativeEdit, setNativeEdit] = useState<NativeTextBlock | null>(null);
  // Caret offset from the click that opened the native editor (caret-at-click).
  const [nativeCaret, setNativeCaret] = useState<number | null>(null);

  // ----- Original-glyph masks ---------------------------------------------
  // Masks are the FALLBACK, not the mechanism: the page removes edited glyphs
  // from the canvas raster itself (true removal). A mask renders only until
  // that lands — or permanently for the rare region removal can't reach — and
  // uses the line's full ink extent in the locally-sampled background colour,
  // so nothing peeks out even while it's the thing you see.
  const maskRects = useMemo(() => {
    const rects: Array<{ id: string; key: string; rect: Rect }> = [];
    for (const o of textObjects) {
      storedWhiteoutBounds(o.metadata).forEach((b, i) => {
        const key = rectKey(b);
        if (!cleanRectKeys.has(key)) rects.push({ id: `${o.id}_wo_${i}`, key, rect: b });
      });
    }
    return rects;
  }, [textObjects, cleanRectKeys]);

  // The line currently being edited inline (pre-commit): mask it the same way,
  // with the exact rect the commit will store, and tell the page so it can
  // remove those glyphs from the raster while the user is still typing.
  const liveEditMask = useMemo(() => {
    if (!nativeEdit) return null;
    const line = nativeEdit.lines[0];
    const rect = line ? lineMaskRect(line) : expandRect(nativeEdit.bounds, 1.2);
    return { key: rectKey(rect), rect };
  }, [nativeEdit]);

  useEffect(() => {
    onLiveEditRect(liveEditMask?.rect ?? null);
    return () => onLiveEditRect(null);
  }, [liveEditMask, onLiveEditRect]);

  // Sample the page canvas for each visible mask's local background colour
  // (re-sampled after every canvas paint — the raster under a mask changes
  // when the true-removal render lands).
  const [maskColors, setMaskColors] = useState<Record<string, string>>({});
  useEffect(() => {
    const canvas = pageElement?.querySelector("canvas");
    const targets = liveEditMask ? [...maskRects, { id: "live", ...liveEditMask }] : maskRects;
    if (!canvas || targets.length === 0) return;
    const sampled: Record<string, string> = {};
    for (const t of targets) {
      const color = sampleBackgroundColor(canvas, pdfToViewportRect(t.rect, zoom));
      if (color) sampled[t.key] = color;
    }
    // Reading the canvas (an external system) has to happen in an effect; only
    // commit when a colour actually changed so this can't loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaskColors((prev) => {
      let changed = false;
      for (const key of Object.keys(sampled)) if (prev[key] !== sampled[key]) changed = true;
      return changed ? { ...prev, ...sampled } : prev;
    });
  }, [maskRects, liveEditMask, pageElement, zoom, paintVersion]);
  // Live ghost rect while dragging a native line to a new position.
  const [lineDrag, setLineDrag] = useState<{ rect: Rect } | null>(null);
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
    (object: EditorTextBlock, result: RichResult) => {
      setEditingId(null);
      const text = result.text;
      const runsChanged = JSON.stringify(result.runs) !== JSON.stringify(object.runs ?? []);
      if (!pageId || (text === object.text && !runsChanged)) return;
      // Auto-grow the box to fit the new text so nothing is clipped (Acrobat-style).
      const font = maxRunFontSize({ ...object, runs: result.runs });
      const measured = measureTextBoxHeight({
        text,
        widthPoints: object.rect.width,
        fontFamily: fontFamilyStack(object.fontFamily, object.pdfFontFamily),
        fontSizePoints: font,
        bold: object.bold,
        italic: object.italic,
        lineHeight: object.lineHeight,
      });
      // Exact line-step growth (see line-box.ts): while the text fits the lines
      // the box already had, the height is untouched — no sub-point re-fit, no
      // shrink — so committing an edit can never nudge this line or, via reflow,
      // anything below it. Growth is whole line steps, matching export leading.
      const targetHeight = lineBoxHeight({
        measuredHeight: measured,
        originalHeight: object.rect.height,
        fontSize: font,
        lineHeight: object.lineHeight,
      });
      const rect = targetHeight > object.rect.height + 0.5 ? { ...object.rect, height: targetHeight } : undefined;
      const edit = updateTextContentOperation(pageId, object, text, rect, result.runs);
      // If the box got taller, push the content below it down by the same amount
      // so the new lines never overlap what's beneath (one undoable step). For a
      // re-edited document line that includes the page's still-native text: those
      // lines are promoted into shifted replacement objects (Acrobat-style reflow).
      const delta = rect ? targetHeight - object.rect.height : 0;
      const oldBottom = object.rect.y + object.rect.height;
      const moves = reflowBelowOps({ pageId, objects, anchorId: object.id, oldBottom, delta });
      const promoted =
        object.source === "original"
          ? reflowNativeBelowOps({ lines: nativeLines, oldBottom, delta })
          : [];
      if (moves.length || promoted.length) dispatchAll([edit, ...moves, ...promoted], "Edit text");
      else dispatch(edit);
    },
    [dispatch, dispatchAll, nativeLines, objects, pageId],
  );

  const commitNativeEdit = useCallback(
    (result: RichResult) => {
      const block = nativeEdit;
      setNativeEdit(null);
      const text = result.text;
      if (!block || !pageId || text === block.text) return;
      const maxFont = result.runs.reduce((m, r) => Math.max(m, r.fontSize ?? block.style.fontSize), block.style.fontSize);
      // Grow the replacement box downward only if the edited text wraps to more
      // lines; growth is exact line steps from the ORIGINAL ink box (line-box.ts)
      // so a single-line edit keeps the box — and everything below — pinned.
      const measured = measureTextBoxHeight({
        text,
        widthPoints: block.bounds.width,
        fontFamily: fontFamilyStack(block.style.font.fallbackFamily, block.style.font.cssName),
        fontSizePoints: maxFont,
        bold: block.style.bold,
        italic: block.style.italic,
        lineHeight: block.style.lineHeight,
      });
      const targetHeight = lineBoxHeight({
        measuredHeight: measured,
        originalHeight: block.bounds.height,
        fontSize: maxFont,
        lineHeight: block.style.lineHeight,
      });
      const rect = targetHeight > block.bounds.height + 0.5 ? { ...block.bounds, height: targetHeight } : undefined;
      const op = createReplacementTextOperation({ source: block, text, runs: result.runs, rect });
      // Push content below down by the growth so a wrapped header doesn't
      // overlap it: store objects move, and the page's still-native lines are
      // promoted into shifted replacement objects (Acrobat-style reflow) —
      // all in the same single undoable batch as the edit itself.
      const delta = rect ? targetHeight - block.bounds.height : 0;
      const oldBottom = block.bounds.y + block.bounds.height;
      const moves = reflowBelowOps({
        pageId,
        objects,
        anchorId: op.type === "ADD_TEXT" ? op.object.id : block.id,
        oldBottom,
        delta,
      });
      const promoted = reflowNativeBelowOps({ lines: nativeLines, excludeId: block.id, oldBottom, delta });
      if (moves.length || promoted.length) dispatchAll([op, ...moves, ...promoted], "Edit text");
      else dispatch(op);
      if (op.type === "ADD_TEXT") select(pageId, [op.object.id]);
    },
    [dispatch, dispatchAll, nativeEdit, nativeLines, objects, pageId, select],
  );

  // A native line: drag past a small threshold to MOVE it (promotes it and
  // re-stamps at the new position, masking the original); a plain click edits it
  // in place at the clicked character. This gives "select a line and move it"
  // without bringing back persistent boxes.
  const onNativeLinePointerDown = useCallback(
    (b: NativeTextBlock, e: ReactPointerEvent) => {
      e.stopPropagation();
      const start = toPoint(e.clientX, e.clientY);
      if (!start) return;
      const left = e.currentTarget.getBoundingClientRect().left;
      const caret = caretIndexAtX({
        text: b.text,
        xPx: e.clientX - left,
        fontSizePx: b.style.fontSize * zoom,
        fontFamily: fontFamilyStack(b.style.font.fallbackFamily, b.style.font.cssName),
        bold: b.style.bold,
        italic: b.style.italic,
      });
      let moved = false;
      const onMove = (ev: globalThis.PointerEvent) => {
        const p = toPoint(ev.clientX, ev.clientY);
        if (!p) return;
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (!moved && Math.hypot(dx, dy) > 4) moved = true;
        if (moved) setLineDrag({ rect: { ...b.bounds, x: b.bounds.x + dx, y: b.bounds.y + dy } });
      };
      const onUp = (ev: globalThis.PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setLineDrag(null);
        if (moved && pageId) {
          const p = toPoint(ev.clientX, ev.clientY) ?? start;
          const rect = { ...b.bounds, x: b.bounds.x + (p.x - start.x), y: b.bounds.y + (p.y - start.y) };
          const op = createReplacementTextOperation({
            source: b,
            text: b.text,
            runs: runsFromSpans(b.lines[0]?.spans ?? []),
            rect,
          });
          dispatch(op);
          if (op.type === "ADD_TEXT") select(pageId, [op.object.id]);
          return;
        }
        // A click (no drag): edit in place at the clicked character.
        setNativeCaret(caret);
        setEditingId(null);
        clearSelection();
        setNativeEdit(b);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [toPoint, zoom, pageId, dispatch, select, clearSelection],
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
      {/* Masks over edited original glyphs — only for rects the canvas hasn't
          truly removed yet (see maskRects); ink-extent geometry + sampled
          background colour so nothing peeks out while they're visible. */}
      {maskRects.map(({ id, key, rect }) => (
        <div
          key={id}
          style={{
            position: "absolute",
            left: rect.x * zoom,
            top: rect.y * zoom,
            width: rect.width * zoom,
            height: rect.height * zoom,
            background: maskColors[key] ?? "#ffffff",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Native text (select mode): each line is an invisible I-beam click zone
          over its glyphs — no boxes. Clicking drops the caret exactly where you
          click and you edit the words in place; a faint hover tint is the only
          hint that the page text is live. */}
      {tool === "select"
        ? nativeLines.map((b) => (
            <div
              key={b.id}
              title="Click to edit · drag to move this line"
              // preventDefault on mousedown stops the browser moving focus to the
              // scroll container, which would instantly blur (and close) the
              // rich editor we open below. Without it, opening works in some
              // browsers and silently closes in others depending on focus timing.
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => onNativeLinePointerDown(b, e)}
              className="absolute rounded-[2px] transition-colors hover:bg-primary/[0.07]"
              style={{
                left: b.bounds.x * zoom,
                top: b.bounds.y * zoom,
                width: b.bounds.width * zoom,
                height: b.bounds.height * zoom,
                cursor: "text",
              }}
            />
          ))
        : null}

      {/* Ghost of a native line being dragged to a new position. */}
      {lineDrag ? (
        <div
          style={{
            position: "absolute",
            left: lineDrag.rect.x * zoom,
            top: lineDrag.rect.y * zoom,
            width: lineDrag.rect.width * zoom,
            height: lineDrag.rect.height * zoom,
            border: "1.5px solid var(--primary)",
            background: "rgba(37,99,235,0.06)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Honest empty state: extraction finished but this page has no selectable
          text (e.g. a scanned image). Without this the page just looks
          un-editable and the user assumes the tool is broken. */}
      {tool === "select" &&
      extracted &&
      !extracted.blocks.some((b) => b.provenance.kind === "native") ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[5] max-w-[90%] -translate-x-1/2 rounded-md bg-foreground/85 px-3 py-1.5 text-center text-[11px] font-medium text-background shadow">
          No selectable text on this page — it looks like a scanned image. Switch to “Add text box” to type on top.
        </div>
      ) : null}

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
          onCommit={(result) => commitObjectText(object, result)}
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

      {/* Mask under the inline editor: covers the original glyphs' full ink
          extent until the canvas render without them lands (then the key turns
          "clean" and the real page background shows through the transparent
          editor — the old text is genuinely gone from the raster). */}
      {nativeEdit && liveEditMask && !cleanRectKeys.has(liveEditMask.key) ? (
        <div
          style={{
            position: "absolute",
            left: liveEditMask.rect.x * zoom,
            top: liveEditMask.rect.y * zoom,
            width: liveEditMask.rect.width * zoom,
            height: liveEditMask.rect.height * zoom,
            background: maskColors[liveEditMask.key] ?? "#ffffff",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Inline rich editor for a native block (before it becomes a store
          object). Keyed by block id so switching directly between text blocks
          remounts and re-seeds; seeded from the line's per-span formatting so
          mixed bold/italic is preserved and only the edited words change. */}
      {nativeEdit ? (
        <div
          style={{
            position: "absolute",
            left: nativeEdit.bounds.x * zoom,
            top: nativeEdit.bounds.y * zoom,
            width: Math.max(nativeEdit.bounds.width, 40) * zoom,
            minHeight: Math.max(nativeEdit.bounds.height, 16) * zoom,
          }}
        >
          <RichTextEditor
            key={nativeEdit.id}
            text={nativeEdit.text}
            runs={runsFromSpans(nativeEdit.lines[0]?.spans ?? [])}
            base={{
              fontFamily: nativeEdit.style.font.available ? nativeEdit.style.font.family : nativeEdit.style.font.fallbackFamily,
              pdfFontFamily: nativeEdit.style.font.cssName,
              fontSize: nativeEdit.style.fontSize,
              color: nativeEdit.style.color,
              bold: nativeEdit.style.bold,
              italic: nativeEdit.style.italic,
              underline: nativeEdit.style.underline,
              lineHeight: nativeEdit.style.lineHeight,
              align: nativeEdit.style.align,
            }}
            zoom={zoom}
            caretIndex={nativeCaret}
            onCommit={commitNativeEdit}
            onCancel={() => setNativeEdit(null)}
            style={{ width: "100%" }}
          />
        </div>
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
  // While a rich editor is focused, Bold/Italic/Underline must act on the live
  // selection (so you can format just one word) instead of the whole block.
  const active = getActiveRichEditor();
  if (active) {
    let handled = false;
    if (style.bold !== undefined) {
      active.toggle("bold");
      handled = true;
    }
    if (style.italic !== undefined) {
      active.toggle("italic");
      handled = true;
    }
    if (style.underline !== undefined) {
      active.toggle("underline");
      handled = true;
    }
    if (handled) return;
  }
  const state = documentStore.getState();
  const pageId = state.selection.pageId;
  if (!pageId || !state.document || state.selection.ids.length === 0) return;
  const objectMap = state.document.objectsByPage[pageId] ?? {};
  const allObjects = Object.values(objectMap);
  const operations: EditOperation[] = [];
  for (const id of state.selection.ids) {
    const o = objectMap[id];
    if (o?.kind !== "text") continue;
    const op = styleTextOperation(pageId, o, style);
    operations.push(op);
    // A larger font / looser line spacing makes the box taller — push the
    // content below it down so styling can't create overlaps either.
    const newRect = op.type === "UPDATE_TEXT" ? op.changes.rect : undefined;
    if (newRect && newRect.height > o.rect.height + 0.5) {
      operations.push(
        ...reflowBelowOps({
          pageId,
          objects: allObjects,
          anchorId: id,
          oldBottom: o.rect.y + o.rect.height,
          delta: newRect.height - o.rect.height,
        }),
      );
    }
  }
  if (operations.length === 0) return;
  state.dispatchAll(operations, "Style text");
}
