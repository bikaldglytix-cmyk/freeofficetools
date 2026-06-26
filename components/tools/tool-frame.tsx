"use client";

import type { ReactNode } from "react";
import { ToolPanel, ProgressView, ResultView, ErrorNote } from "@/components/tools/tool-ui";
import type { useProcessor } from "@/components/tools/use-processor";

type Processor = ReturnType<typeof useProcessor>;

interface ToolFrameProps {
  proc: Processor;
  /** Clears tool state and returns to the empty/idle view. */
  onReset: () => void;
  processingLabel?: string;
  downloadLabel?: string;
  zipName?: string;
  resultSummary?: ReactNode;
  children: ReactNode;
}

/**
 * Shared state shell for every tool: shows the processing, success and error
 * screens, and otherwise renders the tool's own controls.
 */
export function ToolFrame({
  proc,
  onReset,
  processingLabel,
  downloadLabel,
  zipName,
  resultSummary,
  children,
}: ToolFrameProps) {
  return (
    <ToolPanel>
      {proc.status === "processing" ? (
        <ProgressView progress={proc.progress} label={processingLabel} />
      ) : proc.status === "success" && proc.result ? (
        <ResultView
          result={proc.result}
          downloadLabel={downloadLabel}
          summary={resultSummary}
          onDownload={() => proc.download(zipName)}
          onReset={onReset}
        />
      ) : (
        <div className="space-y-5">
          {proc.status === "error" && proc.error ? (
            <ErrorNote message={proc.error} onReset={onReset} />
          ) : null}
          {children}
        </div>
      )}
    </ToolPanel>
  );
}
