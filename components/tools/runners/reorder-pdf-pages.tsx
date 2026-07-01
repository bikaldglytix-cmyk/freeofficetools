"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, ThumbsLoading, type RunnerProps } from "@/components/tools/shared";
import { PageGrid, PageTile } from "@/components/tools/page-grid";
import { usePageThumbnails } from "@/components/tools/use-thumbnails";
import { validateFiles } from "@/lib/files";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

export function ReorderPdfPages({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const { thumbs, loading, error } = usePageThumbnails(file);

  // Reset the page order whenever a new set of thumbnails is produced
  // (the documented "adjust state when a prop changes" pattern — no effect needed).
  const [prevThumbs, setPrevThumbs] = useState(thumbs);
  if (prevThumbs !== thumbs) {
    setPrevThumbs(thumbs);
    setOrder(thumbs.map((t) => t.index));
  }

  const thumbByIndex = new Map(thumbs.map((t) => [t.index, t]));

  function add(incoming: File[]) {
    const { valid, error: e } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (e) return setErr(e);
    setErr(null);
    setFile(valid[0]);
  }

  function move(pos: number, dir: -1 | 1) {
    const j = pos + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[pos], next[j]] = [next[j], next[pos]];
    setOrder(next);
  }

  function reset() {
    setFile(null);
    setOrder([]);
    setErr(null);
    proc.reset();
  }

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Rearranging pages…"
      downloadLabel="Download PDF"
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
              <p className="text-sm text-muted-foreground">Use the arrows to move pages into order.</p>
              <PageGrid>
                {order.map((origIndex, pos) => {
                  const thumb = thumbByIndex.get(origIndex);
                  if (!thumb) return null;
                  return (
                    <PageTile
                      key={origIndex}
                      url={thumb.url}
                      label={`#${pos + 1} (was ${origIndex + 1})`}
                      footer={
                        <span className="flex">
                          <button
                            type="button"
                            aria-label={`Move page to position ${pos}`}
                            disabled={pos === 0}
                            onClick={() => move(pos, -1)}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move page to position ${pos + 2}`}
                            disabled={pos === order.length - 1}
                            onClick={() => move(pos, 1)}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        </span>
                      }
                    />
                  );
                })}
              </PageGrid>
              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={order.length === 0}
                  onClick={() => proc.run((r) => runPdfOp("reorder", [file], { order }, r))}
                >
                  Save new order
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ToolFrame>
  );
}
