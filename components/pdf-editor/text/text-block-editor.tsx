"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Rect, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";

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
  onCommit: (text: string) => void;
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
  const gestureRef = useRef<Gesture | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onTransformRef = useRef(onTransform);
  // Keep the latest callback in a ref for the window listeners below, written
  // after render (refs must not be assigned during render).
  useEffect(() => {
    onTransformRef.current = onTransform;
  });

  // A live gesture is driven off window listeners so a fast drag never drops
  // events when the pointer leaves the small box.
  useEffect(() => {
    if (!interactive) return;
    function onMove(e: globalThis.PointerEvent) {
      const g = gestureRef.current;
      if (!g) return;
      setPreview(applyGesture(g, (e.clientX - g.startX) / zoom, (e.clientY - g.startY) / zoom));
    }
    function onUp(e: globalThis.PointerEvent) {
      const g = gestureRef.current;
      if (!g) return;
      gestureRef.current = null;
      const final = applyGesture(g, (e.clientX - g.startX) / zoom, (e.clientY - g.startY) / zoom);
      setPreview(null);
      onTransformRef.current(final);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [interactive, zoom]);

  useEffect(() => {
    if (!editing) return;
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.select();
    }
  }, [editing]);

  const rect = preview ?? object.rect;

  const startGesture =
    (mode: "move" | "resize", anchor: Anchor) => (e: ReactPointerEvent) => {
      if (!interactive || object.locked || editing) return;
      e.stopPropagation();
      gestureRef.current = { mode, anchor, startX: e.clientX, startY: e.clientY, rect: object.rect };
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
    fontFamily: object.fontFamily,
    fontSize: object.fontSize * zoom,
    color: object.color,
    textAlign: object.align,
    lineHeight: object.lineHeight,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  if (editing) {
    return (
      <div style={containerStyle} data-text-object={object.id}>
        <textarea
          ref={textareaRef}
          defaultValue={object.text}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onCommit((e.target as HTMLTextAreaElement).value);
            }
          }}
          onBlur={(e) => onCommit(e.target.value)}
          style={{
            ...textStyle,
            resize: "none",
            border: "none",
            outline: "2px solid var(--primary)",
            background: "rgba(255,255,255,0.96)",
            padding: 0,
            margin: 0,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      data-text-object={object.id}
      className={interactive ? "cursor-move" : undefined}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onSelect(e.shiftKey);
        startGesture("move", {})(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
    >
      <div style={{ ...textStyle, pointerEvents: "none", userSelect: "none" }}>
        {object.text ? object.text : <span style={{ opacity: 0.4 }}>Text…</span>}
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
