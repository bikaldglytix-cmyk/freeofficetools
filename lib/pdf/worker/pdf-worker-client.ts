"use client";

/**
 * Main-thread entry point for running a PDF operation off the main thread.
 *
 * `runPdfOp(op, files, options, onProgress)` is a drop-in replacement for
 * calling the engine directly: same arguments, same `ProcessResult`, same
 * progress fractions — the work just happens in a shared Web Worker so the UI
 * never freezes. Degrades gracefully in two ways:
 *   - No Worker support  → runs inline on the main thread (identical result).
 *   - Worker script crash → the in-flight request is retried inline, so the
 *     user still gets a result instead of a hard error.
 *
 * One worker is shared across every tool and multiplexed by request id; a single
 * user action at a time means there's rarely more than one in flight.
 */
import type { ProcessResult, ProgressReporter } from "@/lib/process/types";
import type { PdfOp } from "./pdf-ops";

interface PendingRequest {
  op: PdfOp;
  files: File[];
  options: unknown;
  onProgress?: ProgressReporter;
  resolve: (result: ProcessResult) => void;
  reject: (error: unknown) => void;
}

type OutMessage =
  | { type: "progress"; id: number; fraction: number }
  | { type: "result"; id: number; result: ProcessResult }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, PendingRequest>();

function workerSupported(): boolean {
  return typeof Worker !== "undefined";
}

/** Run the op on the current (main) thread via the same registry the worker uses. */
function runInline(req: Pick<PendingRequest, "op" | "files" | "options" | "onProgress">): Promise<ProcessResult> {
  return import("./pdf-ops").then(({ runPdfOpInline }) =>
    runPdfOpInline(req.op, req.files, req.options, { onProgress: req.onProgress }),
  );
}

function spawnWorker(): Worker {
  const w = new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" });

  w.addEventListener("message", (ev: MessageEvent) => {
    const data = ev.data as OutMessage;
    const entry = pending.get(data.id);
    if (!entry) return;
    switch (data.type) {
      case "progress":
        entry.onProgress?.(data.fraction);
        break;
      case "result":
        pending.delete(data.id);
        entry.resolve(data.result);
        break;
      case "error":
        pending.delete(data.id);
        entry.reject(new Error(data.message || "PDF processing failed."));
        break;
    }
  });

  w.addEventListener("error", () => {
    // The worker script itself crashed (not a normal op error, which arrives as
    // an "error" message above). Tear it down and finish every in-flight request
    // on the main thread so the user still gets a result.
    const stranded = [...pending.values()];
    pending.clear();
    if (worker === w) worker = null;
    try {
      w.terminate();
    } catch {
      /* already gone */
    }
    for (const entry of stranded) {
      runInline(entry).then(entry.resolve, entry.reject);
    }
  });

  return w;
}

function ensureWorker(): Worker {
  if (!worker) worker = spawnWorker();
  return worker;
}

export function runPdfOp(
  op: PdfOp,
  files: File[],
  options?: unknown,
  onProgress?: ProgressReporter,
): Promise<ProcessResult> {
  if (!workerSupported()) {
    return runInline({ op, files, options, onProgress });
  }

  const w = ensureWorker();
  const id = ++seq;
  return new Promise<ProcessResult>((resolve, reject) => {
    pending.set(id, { op, files, options, onProgress, resolve, reject });
    try {
      w.postMessage({ type: "run", id, op, files, options });
    } catch {
      // Posting failed (e.g. a value that isn't structured-cloneable) — degrade.
      pending.delete(id);
      runInline({ op, files, options, onProgress }).then(resolve, reject);
    }
  });
}
