"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  accept: string;
  acceptLabel: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function Dropzone({ accept, acceptLabel, multiple, onFiles, disabled, compact }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const id = useId();

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-describedby={id}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-card text-center transition-all hover:border-foreground/30 hover:bg-muted/30",
        compact ? "gap-2 px-6 py-8" : "gap-4 px-6 py-16",
        dragging && "border-foreground bg-muted/50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-md bg-muted text-foreground transition-transform group-hover:scale-105",
          compact ? "size-10" : "size-12",
        )}
      >
        <UploadCloud className={compact ? "size-5" : "size-6"} />
      </span>
      <div>
        <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
          {dragging ? "Drop to add" : multiple ? "Drop files here, or click to browse" : "Drop a file here, or click to browse"}
        </p>
        <p id={id} className="mt-1 text-sm text-muted-foreground">
          Supports {acceptLabel} · Processed privately in your browser
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          // Allow re-selecting the same file.
          e.target.value = "";
        }}
      />
    </div>
  );
}
