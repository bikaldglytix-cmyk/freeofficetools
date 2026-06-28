"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { TextAlign, TextRun } from "@/lib/pdf/editor/model/types";
import { runsToHtml, serializeDom, type RichResult, type RunBaseStyle } from "@/lib/pdf/text/rich-runs";

/**
 * In-place, cursor-first rich text editor (Word/Docs/Acrobat-style). It seeds a
 * `contentEditable` from the block's `TextRun[]` so mixed formatting shows while
 * editing, and serialises back to `{ text, runs }` on commit — so changing one
 * word never restyles the rest of the line. Bold/Italic/Underline apply to the
 * current selection via Ctrl/Cmd+B/I/U.
 *
 * It is intentionally dependency-free (no Slate/ProseMirror): the DOM is the
 * editing surface and {@link serializeDom} reads it back, keeping the bundle and
 * runtime light. The seed is written imperatively and React never re-renders the
 * children, so it behaves as a normal uncontrolled editor (native caret/IME).
 */

export interface RichEditorApi {
  /** Toggle a mark on the current selection; keeps the editor focused. */
  toggle: (cmd: "bold" | "italic" | "underline") => void;
  hasSelection: () => boolean;
}

let activeApi: RichEditorApi | null = null;
/** The rich editor currently focused, if any (lets the toolbar target the live
 *  selection instead of the whole block). Null when nothing is being edited. */
export function getActiveRichEditor(): RichEditorApi | null {
  return activeApi;
}

export interface RichTextEditorProps {
  text: string;
  runs?: TextRun[];
  base: RunBaseStyle & { lineHeight: number; align: TextAlign };
  zoom: number;
  /** Caret character offset to start at (caret-at-click); defaults to end. */
  caretIndex?: number | null;
  onCommit: (result: RichResult) => void;
  onCancel: () => void;
  /** Extra styles merged onto the editable element. */
  style?: CSSProperties;
}

export function RichTextEditor({ text, runs, base, zoom, caretIndex, onCommit, onCancel, style }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // One-shot latch so Enter/Esc and the unmount-blur each settle exactly once.
  const settled = useRef(false);
  const apiRef = useRef<RichEditorApi | null>(null);

  useLayoutEffect(() => {
    settled.current = false;
    const el = ref.current;
    if (!el) return;
    el.innerHTML = runsToHtml(runs && runs.length ? runs : [{ text }], base, zoom);
    el.focus();
    placeCaret(el, caretIndex ?? textLength(el));
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* execCommand unsupported — Ctrl+B/I/U styling is then a no-op, edits still commit */
    }
    const api: RichEditorApi = {
      toggle: (cmd) => {
        el.focus();
        try {
          document.execCommand(cmd);
        } catch {
          /* ignore */
        }
      },
      hasSelection: () => {
        const sel = window.getSelection();
        return !!sel && !sel.isCollapsed && el.contains(sel.anchorNode);
      },
    };
    apiRef.current = api;
    activeApi = api;
    return () => {
      if (activeApi === apiRef.current) activeApi = null;
    };
    // Seed exactly once on mount; later prop changes shouldn't reset the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    if (activeApi === apiRef.current) activeApi = null;
    const el = ref.current;
    onCommit(el ? serializeDom(el, base, zoom) : { text, runs: runs ?? [] });
  };

  const cancel = () => {
    if (settled.current) return;
    settled.current = true;
    if (activeApi === apiRef.current) activeApi = null;
    onCancel();
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
        } else if ((e.ctrlKey || e.metaKey) && "biu".includes(e.key.toLowerCase())) {
          // Sub-range Bold/Italic/Underline — the only way to keep "just this
          // word" formatting without leaving the caret.
          e.preventDefault();
          const cmd = e.key.toLowerCase() === "b" ? "bold" : e.key.toLowerCase() === "i" ? "italic" : "underline";
          try {
            document.execCommand(cmd);
          } catch {
            /* ignore */
          }
        }
      }}
      onBlur={commit}
      style={{
        // Chrome-free in-place editing: white mask hides the original glyphs and
        // the caret is the only visible affordance.
        fontFamily: base.fontFamily,
        fontSize: base.fontSize * zoom,
        fontWeight: base.bold ? 700 : 400,
        fontStyle: base.italic ? "italic" : "normal",
        color: base.color,
        textAlign: base.align,
        lineHeight: base.lineHeight,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        outline: "none",
        background: "#ffffff",
        caretColor: "var(--primary)",
        minWidth: 4,
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------

function textLength(el: HTMLElement): number {
  return (el.textContent ?? "").replace(/​/g, "").length;
}

/** Place the caret at character offset `index` within the editable element. */
function placeCaret(el: HTMLElement, index: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = index;
  let target: { node: Node; offset: number } | null = null;
  const walk = (node: Node): boolean => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const len = (child.textContent ?? "").length;
        if (remaining <= len) {
          target = { node: child, offset: remaining };
          return true;
        }
        remaining -= len;
      } else if (walk(child)) {
        return true;
      }
    }
    return false;
  };
  walk(el);
  const range = document.createRange();
  if (target) {
    range.setStart((target as { node: Node }).node, (target as { offset: number }).offset);
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
