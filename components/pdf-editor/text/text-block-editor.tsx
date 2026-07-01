"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Rect, TextBlock as EditorTextBlock, TextRun } from "@/lib/pdf/editor/model/types";
import { fontFamilyStack } from "@/lib/pdf/text/fonts";
import { caretIndexAtX } from "@/lib/pdf/text/measure";
import type { RichResult } from "@/lib/pdf/text/rich-runs";
import { RichTextEditor } from "./rich-text-editor";

type Anchor = { l?: boolean; r?: boolean; t?: boolean; b?: boolean };

interface Gesture {
  mode: "move" | "resize";
  anchor: Anchor;
  startX: number;
  startY: number;
  rect: Rect;
}

const MIN_SIZE = 8; // page points

const HANDLES: Array<{ key: string; anchor: Anchor; left: string | number; top: string | number; cursor: string }> = [
  { key: "nw", anchor: { l: true, t: true }, left: 0, top: 0, cursor: "nwse-resize" },
  { key: "n", anchor: { t: true }, left: "50%", top: 0, cursor: "ns-resize" },
  { key: "ne", anchor: { r: true, t: true }, left: "100%", top: 0, cursor: "nesw-resize" },
  { key: "e", anchor: { r: true }, left: "100%", top: "50%", cursor: "ew-resize" },
  { key: "se", anchor: { r: true, b: true }, left: "100%", top: "100%", cursor: "nwse-resize" },
  { key: "s", anchor: { b: true }, left: "50%", top: "100%", cursor: "ns-resize" },
  { key: "sw", anchor: { l: true, b: true }, left: 0, top: "100%", cursor: "nesw-resize" },
  { key: "w", anchor: { l: true }, left: 0, top: "50%", cursor: "ew-resize" },
];

/** A single styled run in the static (non-editing) display, so a block with
 *  mixed formatting shows each run's weight/slant/size/colour faithfully. */
function RunSpan({ run, object, zoom }: { run: TextRun; object: EditorTextBlock; zoom: number }) {
  return (
    <span
      style={{
        fontFamily: fontFamilyStack(
          run.fontFamily ?? object.fontFamily,
          run.pdfFontFamily ?? (run.fontFamily === undefined ? object.pdfFontFamily : undefined),
        ),
        fontSize: (run.fontSize ?? object.fontSize) * zoom,
        color: run.color ?? object.color,
        fontWeight: (run.bold ?? object.bold) ? 700 : 400,
        fontStyle: (run.italic ?? object.italic) ? "italic" : "normal",
        textDecoration: run.underline ? "underline" : undefined,
      }}
    >
      {run.text}
    </span>
  );
}

/** Resolve a gesture's pointer delta (already in page points) into a new rect. */
function applyGesture(g: Gesture, dx: number, dy: number): Rect {
  if (g.mode === "move") return { ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy };
  let { x, y, width, height } = g.rect;
  if (g.anchor.l) {
    x = g.rect.x + dx;
    width = g.rect.width - dx;
  }
  if (g.anchor.r) width = g.rect.width + dx;
  if (g.anchor.t) {
    y = g.rect.y + dy;
    height = g.rect.height - dy;
  }
  if (g.anchor.b) height = g.rect.height + dy;
  if (width < MIN_SIZE) {
    if (g.anchor.l) x = g.rect.x + g.rect.width - MIN_SIZE;
    width = MIN_SIZE;
  }
  if (height < MIN_SIZE) {
    if (g.anchor.t) y = g.rect.y + g.rect.height - MIN_SIZE;
    height = MIN_SIZE;
  }
  return { x, y, width, height };
}

interface TextBlockEditorProps {
  object: EditorTextBlock;
  zoom: number;
  selected: boolean;
  editing: boolean;
  interactive: boolean;
  onSelect: (additive: boolean) => void;
  onStartEdit: () => void;
  onCommit: (result: RichResult) => void;
  onCancelEdit: () => void;
  onTransform: (rect: Rect) => void;
}

/**
 * A single store-backed text object rendered as a positioned DOM box. Supports
 * pointer drag-move, eight resize handles, and inline editing via a textarea
 * (native caret/selection/IME). All geometry is in PDF points; the box is
 * painted at `rect * zoom` so it tracks the page through zoom/pan/virtualization.
 */
export function TextBlockEditor({
  object,
  zoom,
  selected,
  editing,
  interactive,
  onSelect,
  onStartEdit,
  onCommit,
  onCancelEdit,
  onTransform,
}: TextBlockEditorProps) {
  const [preview, setPreview] = useState<Rect | null>(null);
  // Character offset of the click that opened the editor, so the caret lands
  // where the user clicked rather than selecting the whole block. State (not a
  // ref) so it's set during the double-click handler and read in the next render.
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  const onTransformRef = useRef(onTransform);
  // Keep the latest transform callback in a ref for the live drag handlers.
  useEffect(() => {
    onTransformRef.current = onTransform;
  });

  // Window listeners are attached only while a drag/resize is in flight (see
  // `startGesture`), not kept alive per text box: a page with many edited blocks
  // would otherwise run every box's move handler on every pointermove. This ref
  // holds the teardown; the unmount effect covers a box removed mid-gesture.
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const rect = preview ?? object.rect;

  const startGesture =
    (mode: "move" | "resize", anchor: Anchor) => (e: ReactPointerEvent) => {
      if (!interactive || object.locked || editing) return;
      e.stopPropagation();
      const g: Gesture = { mode, anchor, startX: e.clientX, startY: e.clientY, rect: object.rect };
      const delta = (ev: globalThis.PointerEvent) =>
        applyGesture(g, (ev.clientX - g.startX) / zoom, (ev.clientY - g.startY) / zoom);
      const onMove = (ev: globalThis.PointerEvent) => setPreview(delta(ev));
      const onUp = (ev: globalThis.PointerEvent) => {
        const final = delta(ev);
        dragCleanup.current?.();
        setPreview(null);
        onTransformRef.current(final);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      dragCleanup.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        dragCleanup.current = null;
      };
    };

  const containerStyle: CSSProperties = {
    position: "absolute",
    left: rect.x * zoom,
    top: rect.y * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
    transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
    transformOrigin: "top left",
    opacity: object.opacity,
  };

  const textStyle: CSSProperties = {
    fontFamily: fontFamilyStack(object.fontFamily, object.pdfFontFamily),
    fontSize: object.fontSize * zoom,
    fontWeight: object.bold ? 700 : 400,
    fontStyle: object.italic ? "italic" : "normal",
    color: object.color,
    textAlign: object.align,
    lineHeight: object.lineHeight,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    width: "100%",
    height: "100%",
  };

  if (editing) {
    return (
      // Height is `auto` (min the box height) so the box hugs the text as it grows.
      <div style={{ ...containerStyle, height: "auto", minHeight: rect.height * zoom }} data-text-object={object.id}>
        <RichTextEditor
          text={object.text}
          runs={object.runs}
          base={{
            fontFamily: object.fontFamily,
            pdfFontFamily: object.pdfFontFamily,
            fontSize: object.fontSize,
            color: object.color,
            bold: Boolean(object.bold),
            italic: Boolean(object.italic),
            lineHeight: object.lineHeight,
            align: object.align,
          }}
          zoom={zoom}
          caretIndex={pendingCaret}
          onCommit={onCommit}
          onCancel={onCancelEdit}
          style={{ width: "100%", padding: 0, margin: 0 }}
        />
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      data-text-object={object.id}
      className={interactive ? "cursor-move" : undefined}
      // Keep the double-click that starts editing from moving focus to the
      // scroll container, which would instantly blur the textarea we mount.
      onMouseDown={interactive ? (e) => e.preventDefault() : undefined}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onSelect(e.shiftKey);
        startGesture("move", {})(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const left = e.currentTarget.getBoundingClientRect().left;
        setPendingCaret(
          caretIndexAtX({
            text: object.text,
            xPx: e.clientX - left,
            fontSizePx: object.fontSize * zoom,
            fontFamily: fontFamilyStack(object.fontFamily, object.pdfFontFamily),
            bold: object.bold,
            italic: object.italic,
          }),
        );
        onStartEdit();
      }}
    >
      <div style={{ ...textStyle, overflow: "visible", pointerEvents: "none", userSelect: "none" }}>
        {object.runs && object.runs.length ? (
          object.runs.map((r, i) => <RunSpan key={i} run={r} object={object} zoom={zoom} />)
        ) : object.text ? (
          object.text
        ) : (
          <span style={{ opacity: 0.4 }}>Text…</span>
        )}
      </div>
      {selected && interactive ? (
        <>
          <div style={{ position: "absolute", inset: 0, outline: "1.5px solid var(--primary)", pointerEvents: "none" }} />
          {HANDLES.map((h) => (
            <div
              key={h.key}
              onPointerDown={startGesture("resize", h.anchor)}
              style={{
                position: "absolute",
                left: h.left,
                top: h.top,
                width: 9,
                height: 9,
                marginLeft: -5,
                marginTop: -5,
                background: "var(--primary)",
                border: "1px solid white",
                borderRadius: 2,
                cursor: h.cursor,
              }}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
