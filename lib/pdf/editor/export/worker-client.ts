/**
 * Client wrapper that runs an export inside the Web Worker (`worker.ts`).
 *
 * Falls back to in-thread export automatically when Workers aren't available
 * (SSR, Node tests, older runtimes), so callers get one API everywhere.
 *
 * Usage:
 *   const exporter = createWorkerExporter();
 *   const result = await exporter.run({ document, source }, { onProgress });
 *   exporter.dispose();
 */
import { ExportError } from "./errors";
import { ExportPipeline } from "./pipeline";
import type { ExportInput, ExportResult, ExportStage } from "./types";

export interface WorkerRunOptions {
  onProgress?: (progress: number, stage: ExportStage) => void;
  signal?: AbortSignal;
}

export interface WorkerExporter {
  run(input: ExportInput, opts?: WorkerRunOptions): Promise<ExportResult>;
  dispose(): void;
}

export function workerSupported(): boolean {
  return typeof Worker !== "undefined";
}

export function createWorkerExporter(): WorkerExporter {
  if (!workerSupported()) {
    // In-thread fallback — identical result, just no off-main-thread benefit.
    const pipeline = new ExportPipeline();
    return {
      run: (input, opts) =>
        pipeline.run({ ...input, options: { ...input.options, onProgress: opts?.onProgress, signal: opts?.signal } }),
      dispose: () => {},
    };
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  let seq = 0;
  const pending = new Map<
    string,
    { resolve: (r: ExportResult) => void; reject: (e: unknown) => void; onProgress?: WorkerRunOptions["onProgress"] }
  >();

  worker.addEventListener("message", (ev: MessageEvent) => {
    const data = ev.data as
      | { type: "progress"; id: string; progress: number; stage: ExportStage }
      | { type: "done"; id: string; result: ExportResult }
      | { type: "error"; id: string; code: string; message: string };
    const entry = pending.get(data.id);
    if (!entry) return;
    if (data.type === "progress") {
      entry.onProgress?.(data.progress, data.stage);
    } else if (data.type === "done") {
      const result = data.result;
      // Rehydrate a Blob from the transferred bytes for convenience.
      if (typeof Blob !== "undefined" && result.bytes) {
        result.blob = new Blob([result.bytes as unknown as BlobPart], { type: "application/pdf" });
      }
      pending.delete(data.id);
      entry.resolve(result);
    } else {
      pending.delete(data.id);
      entry.reject(new ExportError(data.code as ExportError["code"], data.message));
    }
  });

  return {
    run(input, opts) {
      const id = `w${++seq}`;
      const source = toTransferable(input.source);
      return new Promise<ExportResult>((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress: opts?.onProgress });
        opts?.signal?.addEventListener("abort", () => {
          // Workers can't be partially cancelled mid-run; terminate + settle.
          pending.delete(id);
          reject(new ExportError("CANCELLED", "Export cancelled."));
        });
        worker.postMessage(
          {
            type: "run",
            id,
            document: input.document,
            source,
            options: stripFns(input.options),
          },
          source ? [source] : [],
        );
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}

function toTransferable(source: ExportInput["source"]): ArrayBuffer | null {
  if (!source) return null;
  if (source instanceof ArrayBuffer) return source;
  // Copy the view's bytes into a standalone ArrayBuffer for transfer.
  return source.slice().buffer;
}

function stripFns(options: ExportInput["options"]): Record<string, unknown> {
  if (!options) return {};
  const rest: Record<string, unknown> = { ...options };
  delete rest.signal;
  delete rest.onProgress;
  return rest;
}
