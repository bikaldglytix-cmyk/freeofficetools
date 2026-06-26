"use client";

import { useState, useId, useRef, type DragEvent } from "react";
import Link from "next/link";
import { UploadCloud, FileType2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tools } from "@/lib/tools";

export function UniversalDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf");
    if (files.length) {
      setDroppedFiles(files);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  if (droppedFiles.length > 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card p-8 shadow-soft animate-in zoom-in-95 duration-300">
        <button 
          onClick={() => setDroppedFiles([])}
          className="absolute right-6 top-6 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileType2 className="size-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {droppedFiles.length} file{droppedFiles.length > 1 ? 's' : ''} ready
          </h2>
          <p className="text-muted-foreground mt-1">What do you want to do?</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tools.slice(0, 4).map((tool) => (
            <Link
              key={tool.slug}
              href={`/pdf-tools/${tool.slug}`}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm group"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <tool.icon className="size-5" />
              </div>
              <div className="font-medium text-[15px]">{tool.name}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
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
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-card py-24 text-center transition-all hover:border-foreground/30 hover:bg-muted/30 shadow-soft",
        isDragging && "border-foreground bg-muted/50 scale-[1.02]",
      )}
    >
      <span className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted text-foreground transition-transform group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary">
        <UploadCloud className="size-10" />
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {isDragging ? "Drop to process" : "Drop your PDF here"}
      </h2>
      <p id={id} className="mt-4 text-lg text-muted-foreground">
        or click to browse. Fully private, browser-based processing.
      </p>
      
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => f.type === "application/pdf");
          if (files.length) setDroppedFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
