"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Download, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, totalSize } from "@/lib/files";
import type { ProcessResult } from "@/lib/process/types";

/** The container that frames every interactive tool widget within the WorkspaceLayout. */
export function ToolPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col p-6 sm:p-10">
      {children}
    </div>
  );
}

export function ProgressView({ progress, label }: { progress: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" aria-live="polite">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-medium text-foreground">{label ?? "Processing…"}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${Math.max(4, progress)}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{progress}%</p>
      </div>
    </div>
  );
}

export function ErrorNote({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-semibold text-foreground">That didn&apos;t work</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        Try again
      </Button>
    </div>
  );
}

interface ResultViewProps {
  result: ProcessResult;
  onDownload: () => void;
  onReset: () => void;
  downloadLabel?: string;
  summary?: ReactNode;
}

export function ResultView({ result, onDownload, onReset, downloadLabel = "Download", summary }: ResultViewProps) {
  const count = result.outputs.length;
  const size = formatBytes(totalSize(result));
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center" aria-live="polite">
      <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-8" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Done — your file is ready</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {count === 1 ? `1 file · ${size}` : `${count} files · ${size} (zipped)`}
        </p>
        {summary ? <div className="mt-2 text-sm text-muted-foreground">{summary}</div> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={onDownload}>
          <Download /> {downloadLabel}
        </Button>
        <Button size="lg" variant="ghost" onClick={onReset}>
          <RotateCcw /> Start over
        </Button>
      </div>
    </div>
  );
}
