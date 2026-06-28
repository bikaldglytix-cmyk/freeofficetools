"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, StretchVertical } from "lucide-react";
import type { TextAlign, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { analyzePdfFont, matchFont } from "@/lib/pdf/text/fonts";
import { cn } from "@/lib/utils";
import { applyStyleToSelectedText } from "@/components/pdf-editor/text";

const FONT_FAMILIES = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"];
const HEX = /^#[0-9a-f]{6}$/i;

const ALIGNS: Array<[TextAlign, typeof AlignLeft, string]> = [
  ["left", AlignLeft, "Align left"],
  ["center", AlignCenter, "Align center"],
  ["right", AlignRight, "Align right"],
];

function toHex(color: string | undefined): string {
  return color && HEX.test(color) ? color : "#111827";
}

/**
 * The font / size / colour / weight / alignment controls for the selected text
 * block. Extracted from the toolbar so the same control set can live in the
 * inline popover that floats above the selected box (closer to the text being
 * edited). Acts on the live store selection via {@link applyStyleToSelectedText}.
 */
export function TextStyleControls({ object }: { object: EditorTextBlock }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Font family"
        title="Font family"
        value={object.fontFamily ?? "Arial"}
        onChange={(e) => applyStyleToSelectedText({ font: matchFont(analyzePdfFont(e.target.value)) })}
        className="h-8 rounded-md border border-border bg-background px-1 text-xs text-foreground"
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
        value={Math.round(object.fontSize ?? 14)}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) applyStyleToSelectedText({ fontSize: n });
        }}
        className="h-8 w-14 rounded-md border border-border bg-background px-1 text-xs text-foreground"
      />

      <input
        type="color"
        aria-label="Text color"
        title="Text color"
        value={toHex(object.color)}
        onChange={(e) => applyStyleToSelectedText({ color: e.target.value })}
        className="h-8 w-8 rounded-md border border-border bg-background"
      />

      {/* Custom line spacing: any value the user types (not just presets). The
          box re-fits its height and content below reflows down accordingly. */}
      <div className="flex items-center gap-1" title="Line spacing (type any value)">
        <StretchVertical className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="number"
          aria-label="Line spacing"
          min={0.5}
          max={6}
          step={0.05}
          value={Number((object.lineHeight ?? 1.2).toFixed(2))}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0.5 && n <= 6) applyStyleToSelectedText({ lineHeight: n });
          }}
          className="h-8 w-14 rounded-md border border-border bg-background px-1 text-xs text-foreground"
        />
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={Boolean(object.bold)}
          onClick={() => applyStyleToSelectedText({ bold: !object.bold })}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            object.bold
              ? "bg-primary-soft text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={Boolean(object.italic)}
          onClick={() => applyStyleToSelectedText({ italic: !object.italic })}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            object.italic
              ? "bg-primary-soft text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Italic className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-0.5">
        {ALIGNS.map(([al, Icon, label]) => (
          <button
            key={al}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={object.align === al}
            onClick={() => applyStyleToSelectedText({ align: al })}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors",
              object.align === al
                ? "bg-primary-soft text-primary ring-1 ring-primary/40"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
