"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, ThumbsLoading, type RunnerProps } from "@/components/tools/shared";
import { PageGrid, PageTile } from "@/components/tools/page-grid";
import { usePageThumbnails } from "@/components/tools/use-thumbnails";
import { validateFiles } from "@/lib/files";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

export function ExtractPdfPages({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { thumbs, loading, error } = usePageThumbnails(file);

  function add(incoming: File[]) {
    const { valid, error: e } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (e) return setErr(e);
    setErr(null);
    setSelected(new Set());
    setFile(valid[0]);
  }

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  function reset() {
    setFile(null);
    setSelected(new Set());
    setErr(null);
    proc.reset();
  }

  const canRun = !!file && selected.size > 0;

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Extracting pages…"
      downloadLabel="Download new PDF"
    >
      {!file ? (
        <>
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </>
      ) : (
        <div className="space-y-4">
          <FilePill name={file.name} size={file.size} onRemove={reset} />
          {loading ? (
            <ThumbsLoading />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Tap pages to keep · {selected.size} selected
                </p>
                {selected.size > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                ) : null}
              </div>
              <PageGrid>
                {thumbs.map((t) => (
                  <PageTile
                    key={t.index}
                    url={t.url}
                    label={`Page ${t.index + 1}`}
                    selected={selected.has(t.index)}
                    onToggle={() => toggle(t.index)}
                    ariaLabel={`Keep page ${t.index + 1}`}
                  />
                ))}
              </PageGrid>
              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={!canRun}
                  onClick={() =>
                    proc.run((r) =>
                      runPdfOp("extract-pages", [file], { pages: [...selected].sort((a, b) => a - b) }, r),
                    )
                  }
                >
                  Extract {selected.size > 0 ? selected.size : ""} page{selected.size === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ToolFrame>
  );
}
