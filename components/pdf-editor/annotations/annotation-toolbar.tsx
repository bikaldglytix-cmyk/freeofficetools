"use client";

import {
  Circle,
  Highlighter,
  MessageSquare,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  Signature,
  StickyNote,
  Stamp,
  Slash,
  Trash2,
  Undo2,
  Redo2,
  ArrowUpRight,
} from "lucide-react";
import type { AnnotationTool } from "@/lib/pdf/annotations";
import { useSelection, useUndoRedo, useDocumentStore } from "@/lib/pdf/editor/store/hooks";
import { cn } from "@/lib/utils";

interface AnnotationToolbarProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onDeleteSelection: () => void;
}

const TOOLS: Array<{ id: AnnotationTool; label: string; icon: React.ReactNode }> = [
  { id: "select", label: "Select annotations", icon: <MousePointer2 className="size-4" /> },
  { id: "highlight", label: "Highlight text", icon: <Highlighter className="size-4" /> },
  { id: "draw", label: "Draw", icon: <PenLine className="size-4" /> },
  { id: "rectangle", label: "Rectangle", icon: <RectangleHorizontal className="size-4" /> },
  { id: "circle", label: "Circle", icon: <Circle className="size-4" /> },
  { id: "line", label: "Line", icon: <Slash className="size-4" /> },
  { id: "arrow", label: "Arrow", icon: <ArrowUpRight className="size-4" /> },
  { id: "comment", label: "Comment", icon: <MessageSquare className="size-4" /> },
  { id: "sticky-note", label: "Sticky note", icon: <StickyNote className="size-4" /> },
  { id: "signature", label: "Signature", icon: <Signature className="size-4" /> },
  { id: "stamp", label: "Stamp", icon: <Stamp className="size-4" /> },
];

export function AnnotationToolbar({ tool, onToolChange, onDeleteSelection }: AnnotationToolbarProps) {
  const selection = useSelection();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const dirty = useDocumentStore((s) => s.dirty);
  const hasSelection = selection.ids.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
      {TOOLS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-pressed={tool === item.id}
          onClick={() => onToolChange(item.id)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            tool === item.id
              ? "bg-primary-soft text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {item.icon}
        </button>
      ))}

      <span className="mx-1 h-5 w-px bg-border" />

      <button
        type="button"
        title="Delete selected annotations"
        aria-label="Delete selected annotations"
        disabled={!hasSelection}
        onClick={onDeleteSelection}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Undo2 className="size-4" />
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Redo2 className="size-4" />
      </button>

      <span className="ml-auto px-2 text-xs text-muted-foreground">{dirty ? "Unsaved" : "Saved"}</span>
    </div>
  );
}
