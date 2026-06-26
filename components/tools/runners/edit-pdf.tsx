"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { Dropzone } from "@/components/tools/dropzone";
import { Button } from "@/components/ui/button";
import { validateFiles, formatBytes } from "@/lib/files";
import type { RunnerProps } from "@/components/tools/shared";
import { PdfViewer } from "@/components/pdf-editor/viewer/pdf-viewer";

/**
 * Runner for the PDF Editor. Phase 1 delivers the viewer foundation: open a PDF
 * and read, zoom, pan, search, navigate and select text — all in the browser.
 * Annotation, text editing and export arrive in later phases and mount into
 * this same shell.
 */
export function EditPdf({ tool }: RunnerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    <div className="flex h-[78vh] min-h-[560px] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFile(null)}>
          <X className="size-4" /> Close
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <PdfViewer key={file.name + file.size} file={file} />
      </div>
    </div>
  );
}
