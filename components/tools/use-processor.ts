"use client";

import { useCallback, useState } from "react";
import type { ProcessResult, ProgressReporter } from "@/lib/process/types";
import { downloadResult } from "@/lib/files";
import { track, ToolEvents } from "@/lib/analytics";

export type ProcessorStatus = "idle" | "processing" | "success" | "error";

/**
 * Owns the run/progress/result/error state machine shared by every tool.
 * Tools keep their own file/options state and just call `run(task)`.
 */
export function useProcessor(toolSlug: string) {
  const [status, setStatus] = useState<ProcessorStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const run = useCallback(
    async (task: (report: ProgressReporter) => Promise<ProcessResult>) => {
      setStatus("processing");
      setProgress(0);
      setError(null);
      setResult(null);
      track(ToolEvents.started, { tool: toolSlug });
      try {
        const res = await task((f) => setProgress(Math.min(100, Math.round(f * 100))));
        setResult(res);
        setProgress(100);
        setStatus("success");
        track(ToolEvents.completed, { tool: toolSlug });
      } catch (e) {
        const message =
          e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
        setError(message);
        setStatus("error");
        track(ToolEvents.failed, { tool: toolSlug });
      }
    },
    [toolSlug],
  );

  const download = useCallback(
    async (zipName?: string) => {
      if (!result) return;
      await downloadResult(result, zipName);
      track(ToolEvents.downloaded, { tool: toolSlug });
    },
    [result, toolSlug],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { status, progress, error, result, run, download, reset };
}
