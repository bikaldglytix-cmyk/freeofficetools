"use client";

import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Circle,
  Highlighter,
  ImagePlus,
  MessageSquare,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  Redo2,
  RefreshCw,
  Signature as SignatureIcon,
  Slash,
  Stamp,
  StickyNote,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import type { AnnotationTool } from "@/lib/pdf/annotations";
import { useDocument, useDocumentStore, useSelection, useUndoRedo } from "@/lib/pdf/editor/store/hooks";
import { cn } from "@/lib/utils";
import { deleteSelectedAnnotations } from "@/components/pdf-editor/annotations/annotation-layer";
import { deleteSelectedText, type TextTool } from "@/components/pdf-editor/text";
import { TextControls } from "./text-controls";

/** The top-level "what am I doing right now" selector for the editor. */
export type EditorMode = "view" | "text" | "image" | "annotate" | "draw" | "sign";

const MODES: Array<{ id: EditorMode; label: string; icon: ReactNode }> = [
  { id: "view", label: "View", icon: <MousePointer2 className="size-4" /> },
  { id: "text", label: "Edit Text", icon: <Type className="size-4" /> },
  { id: "image", label: "Images", icon: <ImagePlus className="size-4" /> },
  { id: "annotate", label: "Annotate", icon: <Highlighter className="size-4" /> },
  { id: "draw", label: "Draw", icon: <PenLine className="size-4" /> },
  { id: "sign", label: "Sign", icon: <SignatureIcon className="size-4" /> },
];

const ANNOTATION_TOOLS: Record<AnnotationTool, { label: string; icon: ReactNode }> = {
  select: { label: "Select", icon: <MousePointer2 className="size-4" /> },
  highlight: { label: "Highlight", icon: <Highlighter className="size-4" /> },
  comment: { label: "Comment", icon: <MessageSquare className="size-4" /> },
  "sticky-note": { label: "Sticky note", icon: <StickyNote className="size-4" /> },
  draw: { label: "Free draw", icon: <PenLine className="size-4" /> },
  rectangle: { label: "Rectangle", icon: <RectangleHorizontal className="size-4" /> },
  circle: { label: "Circle", icon: <Circle className="size-4" /> },
  line: { label: "Line", icon: <Slash className="size-4" /> },
  arrow: { label: "Arrow", icon: <ArrowUpRight className="size-4" /> },
  signature: { label: "Signature", icon: <SignatureIcon className="size-4" /> },
  stamp: { label: "Stamp", icon: <Stamp className="size-4" /> },
};

const MODE_ANNOTATION_TOOLS: Record<"annotate" | "draw" | "sign", AnnotationTool[]> = {
  annotate: ["highlight", "comment", "sticky-note"],
  draw: ["draw", "rectangle", "circle", "line", "arrow"],
  sign: ["signature", "stamp"],
};

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  annotationTool: AnnotationTool;
  onAnnotationToolChange: (tool: AnnotationTool) => void;
  textTool: TextTool;
  onTextToolChange: (tool: TextTool) => void;
  /** Open the file picker to insert a new image on the current page. */
  onInsertImage: () => void;
  /** Open the file picker to swap the bitmap of the selected image. */
  onReplaceImage: () => void;
}

/**
 * The unified editor toolbar. The top row is a labelled mode switcher (only one
 * mode is active at a time) plus the always-available undo / redo / delete and
 * the save state. The second row shows controls and a plain-language hint for
 * whichever mode is active. This replaces the previous stack of unlabelled
 * icon rows that made it impossible to tell which tool edits text.
 */
export function EditorToolbar({
  mode,
  onModeChange,
  annotationTool,
  onAnnotationToolChange,
  textTool,
  onTextToolChange,
  onInsertImage,
  onReplaceImage,
}: EditorToolbarProps) {
  const selection = useSelection();
  const doc = useDocument();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const dirty = useDocumentStore((s) => s.dirty);
  const hasSelection = selection.ids.length > 0;
  const imageSelected =
    !!doc &&
    !!selection.pageId &&
    selection.ids.length === 1 &&
    doc.objectsByPage[selection.pageId]?.[selection.ids[0]]?.kind === "image";

  const onDelete = () => (mode === "text" ? deleteSelectedText() : deleteSelectedAnnotations());

  return (
    <div className="border-b border-border bg-card">
      {/* Mode switcher + global actions. */}
      <div className="flex min-h-12 items-center gap-2 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg bg-muted/60 p-0.5 [-webkit-overflow-scrolling:touch]">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                aria-pressed={active}
                title={m.label}
                className={cn(
                  "flex h-9 shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors sm:h-8",
                  active
                    ? "bg-card text-primary shadow-sm ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.icon}
                <span className="hidden min-[390px]:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ActionButton label="Delete selection" disabled={!hasSelection} onClick={onDelete}>
            <Trash2 className="size-4" />
          </ActionButton>
          <ActionButton label="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 className="size-4" />
          </ActionButton>
          <ActionButton label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 className="size-4" />
          </ActionButton>
          <span className="hidden px-1.5 text-xs font-medium text-muted-foreground sm:inline">{dirty ? "Unsaved" : "Saved"}</span>
        </div>
      </div>

      {/* Contextual controls for the active mode. */}
      <div className="flex min-h-11 items-center gap-2 overflow-x-auto border-t border-border/60 bg-muted/20 px-2 py-1.5 [-webkit-overflow-scrolling:touch]">
        {mode === "text" ? (
          <TextControls textTool={textTool} onTextToolChange={onTextToolChange} />
        ) : mode === "image" ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onInsertImage}
              title="Insert image"
              className="flex h-9 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-8"
            >
              <ImagePlus className="size-4" />
              <span>Insert image</span>
            </button>
            <button
              type="button"
              onClick={onReplaceImage}
              disabled={!imageSelected}
              title={imageSelected ? "Replace selected image" : "Select an image first"}
              className="flex h-9 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:h-8"
            >
              <RefreshCw className="size-4" />
              <span>Replace</span>
            </button>
          </div>
        ) : mode === "annotate" || mode === "draw" || mode === "sign" ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {MODE_ANNOTATION_TOOLS[mode].map((id) => {
              const meta = ANNOTATION_TOOLS[id];
              const active = annotationTool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onAnnotationToolChange(id)}
                  aria-pressed={active}
                  title={meta.label}
                  className={cn(
                    "flex h-9 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors sm:h-8",
                    active
                      ? "bg-primary-soft text-primary ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:size-8"
    >
      {children}
    </button>
  );
}
