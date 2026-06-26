"use client";

import { useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, ThumbsLoading, type RunnerProps } from "@/components/tools/shared";
import { PageGrid, PageTile } from "@/components/tools/page-grid";
import { usePageThumbnails } from "@/components/tools/use-thumbnails";
import { validateFiles } from "@/lib/files";
import { rotatePdfPages } from "@/lib/pdf/rotate";

function norm(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function RotatePdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rotations, setRotations] = useState<number[]>([]);
  const { thumbs, loading, error } = usePageThumbnails(file);

  // Reset per-page rotations whenever a new set of thumbnails is produced.
  const [prevThumbs, setPrevThumbs] = useState(thumbs);
  if (prevThumbs !== thumbs) {
    setPrevThumbs(thumbs);
    setRotations(thumbs.map(() => 0));
  }

  function add(incoming: File[]) {
    const { valid, error: e } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (e) return setErr(e);
    setErr(null);
    setFile(valid[0]);
  }

  function rotateOne(i: number, deg: number) {
    setRotations((prev) => prev.map((r, idx) => (idx === i ? norm(r + deg) : r)));
  }

  function rotateAll(deg: number) {
    setRotations((prev) => prev.map((r) => norm(r + deg)));
  }

  function reset() {
    setFile(null);
    setRotations([]);
    setErr(null);
    proc.reset();
  }

  const hasChanges = rotations.some((r) => r !== 0);

  return (
    <ToolFrame proc={proc} onReset={reset} processingLabel="Rotating pages…" downloadLabel="Download PDF">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Rotate individual pages, or all at once.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => rotateAll(-90)}>
                    <RotateCcw /> All left
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => rotateAll(90)}>
                    <RotateCw /> All right
                  </Button>
                </div>
              </div>
              <PageGrid>
                {thumbs.map((t) => (
                  <PageTile
                    key={t.index}
                    url={t.url}
                    label={`Page ${t.index + 1}`}
                    rotation={rotations[t.index] ?? 0}
                    footer={
                      <span className="flex">
                        <button
                          type="button"
                          aria-label={`Rotate page ${t.index + 1} left`}
                          onClick={() => rotateOne(t.index, -90)}
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <RotateCcw className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Rotate page ${t.index + 1} right`}
                          onClick={() => rotateOne(t.index, 90)}
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                        >
                          <RotateCw className="size-4" />
                        </button>
                      </span>
                    }
                  />
                ))}
              </PageGrid>
              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={!hasChanges}
                  onClick={() => proc.run((r) => rotatePdfPages([file], { rotations }, { onProgress: r }))}
                >
                  Apply rotation
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ToolFrame>
  );
}
