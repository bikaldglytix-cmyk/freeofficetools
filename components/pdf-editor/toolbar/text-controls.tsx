"use client";

import { MousePointerClick, TextCursorInput } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TextTool } from "@/components/pdf-editor/text";

interface TextControlsProps {
  textTool: TextTool;
  onTextToolChange: (tool: TextTool) => void;
}

/**
 * The "Edit Text" mode controls. Just the plain-language action picker now —
 * "Edit existing" (click text on the page to change it) vs "Add text box"
 * (drag a new box). The font / size / colour / weight controls moved into the
 * inline popover that floats above the selected text box, so the toolbar stays
 * a single, uncluttered row.
 */
export function TextControls({ textTool, onTextToolChange }: TextControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
