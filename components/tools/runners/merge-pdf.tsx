"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, type RunnerProps } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

export function MergePdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function add(incoming: File[]) {
    const combined = [...files, ...incoming];
    const { valid, error } = validateFiles(combined, { accept: tool.accept, multiple: true });
    if (error) return setErr(error);
    setErr(null);
    setFiles(valid);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  }

  function reset() {
    setFiles([]);
    setErr(null);
    proc.reset();
  }

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Merging your PDFs…"
      downloadLabel="Download merged PDF"
    >
      <Dropzone
        accept={tool.accept}
        acceptLabel={tool.acceptLabel}
        multiple
        compact={files.length > 0}
        onFiles={add}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {files.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {files.length} file{files.length > 1 ? "s" : ""} — reorder with the arrows
          </p>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <FilePill
                  name={f.name}
                  size={f.size}
                  index={i}
                  onRemove={() => setFiles(files.filter((_, idx) => idx !== i))}
                  controls={
                    <div className="flex items-center">
                      <button
                        type="button"
                        aria-label={`Move ${f.name} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${f.name} down`}
                        disabled={i === files.length - 1}
                        onClick={() => move(i, 1)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-end gap-1 pt-1">
            <Button
              size="lg"
              disabled={files.length < 2}
              onClick={() => proc.run((report) => runPdfOp("merge", files, undefined, report))}
            >
              Merge PDF
            </Button>
            {files.length < 2 ? (
              <p className="text-xs text-muted-foreground">Add at least two PDFs to merge.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToolFrame>
  );
}
