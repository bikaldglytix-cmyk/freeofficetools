"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { Dropzone } from "@/components/tools/dropzone";
import { Button } from "@/components/ui/button";
import { validateFiles, formatBytes } from "@/lib/files";
import type { RunnerProps } from "@/components/tools/shared";

const PdfViewer = dynamic(() => import("@/components/pdf-editor/viewer/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Opening editor...
      </span>
    </div>
  ),
});

/** Runner for the PDF Editor: open, edit, annotate, sign and export in-browser. */
export function EditPdf({ tool }: RunnerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [file]);

  function add(incoming: File[]) {
    const { valid, error } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (error) return setErr(error);
    setErr(null);
    setFile(valid[0]);
  }

  if (!file) {
    return (
      <div className="flex h-full flex-col justify-center p-6 sm:p-10">
        <div className="space-y-4">
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <p className="text-center text-xs text-muted-foreground">
            Your PDF is opened and rendered entirely in your browser — nothing is uploaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pdf-editor-workspace fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-label="PDF editor"
    >
      <div className="flex min-h-12 items-center gap-3 border-b border-border bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFile(null)} title="Close editor" aria-label="Close editor">
          <X className="size-4" />
          <span className="hidden sm:inline">Close</span>
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <PdfViewer key={file.name + file.size} file={file} />
      </div>
    </div>
  );
}
