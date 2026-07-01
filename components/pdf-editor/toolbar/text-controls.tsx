"use client";

import { MousePointerClick, TextCursorInput } from "lucide-react";
import type { TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { useDocument, useSelection } from "@/lib/pdf/editor/store/hooks";
import { cn } from "@/lib/utils";
import { type TextTool } from "@/components/pdf-editor/text";
import { TextStyleControls } from "./text-style-controls";

interface TextControlsProps {
  textTool: TextTool;
  onTextToolChange: (tool: TextTool) => void;
}

/**
 * The "Edit Text" mode controls: the plain-language action picker ("Edit
 * existing" vs "Add text box") plus — when a single text box is selected — the
 * font / size / colour / weight controls. These live here in the toolbar, NOT
 * in a popover floating over the page, so nothing covers the text being edited.
 */
export function TextControls({ textTool, onTextToolChange }: TextControlsProps) {
  const selection = useSelection();
  const doc = useDocument();
  const selected =
    doc && selection.pageId && selection.ids.length === 1
      ? doc.objectsByPage[selection.pageId]?.[selection.ids[0]]
      : undefined;
  const selectedText = selected?.kind === "text" ? (selected as EditorTextBlock) : null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="flex items-center gap-0.5 rounded-md bg-card p-0.5 ring-1 ring-border">
        <SegButton
          active={textTool === "select"}
          onClick={() => onTextToolChange("select")}
          icon={<MousePointerClick className="size-3.5" />}
          label="Edit existing"
        />
        <SegButton
          active={textTool === "add"}
          onClick={() => onTextToolChange("add")}
          icon={<TextCursorInput className="size-3.5" />}
          label="Add text box"
        />
      </div>
      {selectedText ? <TextStyleControls object={selectedText} /> : null}
    </div>
  );
}

function SegButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded px-2 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden min-[390px]:inline">{label}</span>
    </button>
  );
}
