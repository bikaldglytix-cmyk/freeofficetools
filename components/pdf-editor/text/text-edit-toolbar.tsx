"use client";

import { useMemo } from "react";
import { AlignCenter, AlignLeft, AlignRight, MousePointer2, TextCursorInput, Trash2, Type } from "lucide-react";
import type { TextAlign, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { usePageObjects, useSelection } from "@/lib/pdf/editor/store/hooks";
import { analyzePdfFont, matchFont } from "@/lib/pdf/text/fonts";
import { cn } from "@/lib/utils";
import { applyStyleToSelectedText, deleteSelectedText, type TextTool } from "./text-edit-layer";

const FONT_FAMILIES = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"];
const HEX = /^#[0-9a-f]{6}$/i;

const btnBase = "flex size-8 items-center justify-center rounded-md transition-colors";
const btnActive = "bg-primary-soft text-primary ring-1 ring-primary/40";
const btnIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";
const btnDisabled = "disabled:pointer-events-none disabled:opacity-40";

const ALIGNS: Array<[TextAlign, typeof AlignLeft, string]> = [
  ["left", AlignLeft, "Align left"],
  ["center", AlignCenter, "Align center"],
  ["right", AlignRight, "Align right"],
];

function toHex(color: string | undefined): string {
  return color && HEX.test(color) ? color : "#111827";
}

interface TextEditToolbarProps {
  tool: TextTool;
  onToolChange: (tool: TextTool) => void;
}

/**
 * Toolbar for the text-editing subsystem: tool selection (off / select / add)
 * plus style controls that operate on the current text selection through the
 * Phase 2 store via {@link applyStyleToSelectedText} / {@link deleteSelectedText}.
 */
export function TextEditToolbar({ tool, onToolChange }: TextEditToolbarProps) {
  const selection = useSelection();
  const objects = usePageObjects(selection.pageId ?? "");
  const selected = useMemo(
    () => objects.find((o): o is EditorTextBlock => o.kind === "text" && selection.ids.includes(o.id)),
    [objects, selection.ids],
  );
  const has = Boolean(selected);

  const tools: Array<{ id: TextTool; label: string; icon: React.ReactNode }> = [
    { id: "off", label: "Text editing off", icon: <Type className="size-4" /> },
    { id: "select", label: "Select & edit existing text", icon: <MousePointer2 className="size-4" /> },
    { id: "add", label: "Add a text box", icon: <TextCursorInput className="size-4" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
      {tools.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-pressed={tool === item.id}
          onClick={() => onToolChange(item.id)}
          className={cn(btnBase, tool === item.id ? btnActive : btnIdle)}
        >
          {item.icon}
        </button>
      ))}

      <span className="mx-1 h-5 w-px bg-border" />

      <select
        aria-label="Font family"
        title="Font family"
        disabled={!has}
        value={selected?.fontFamily ?? "Arial"}
        onChange={(e) => applyStyleToSelectedText({ font: matchFont(analyzePdfFont(e.target.value)) })}
        className="h-8 rounded-md border border-border bg-background px-1 text-xs text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <input
        type="number"
        aria-label="Font size"
        title="Font size"
        min={4}
        max={400}
        disabled={!has}
        value={Math.round(selected?.fontSize ?? 14)}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) applyStyleToSelectedText({ fontSize: n });
        }}
        className="h-8 w-14 rounded-md border border-border bg-background px-1 text-xs text-foreground disabled:pointer-events-none disabled:opacity-40"
      />

      <input
        type="color"
        aria-label="Text color"
        title="Text color"
        disabled={!has}
        value={toHex(selected?.color)}
        onChange={(e) => applyStyleToSelectedText({ color: e.target.value })}
        className="h-8 w-8 rounded-md border border-border bg-background disabled:pointer-events-none disabled:opacity-40"
      />

      {ALIGNS.map(([al, Icon, label]) => (
        <button
          key={al}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={selected?.align === al}
          disabled={!has}
          onClick={() => applyStyleToSelectedText({ align: al })}
          className={cn(btnBase, selected?.align === al ? btnActive : btnIdle, btnDisabled)}
        >
          <Icon className="size-4" />
        </button>
      ))}

      <span className="mx-1 h-5 w-px bg-border" />

      <button
        type="button"
        title="Delete selected text"
        aria-label="Delete selected text"
        disabled={!has}
        onClick={deleteSelectedText}
        className={cn(btnBase, btnIdle, btnDisabled)}
      >
        <Trash2 className="size-4" />
      </button>

      <span className="ml-auto px-2 text-[11px] text-muted-foreground">
        {tool === "off" ? "Text editing paused" : tool === "add" ? "Click or drag on a page to add text" : "Click text to edit; double-click a box to retype"}
      </span>
    </div>
  );
}
