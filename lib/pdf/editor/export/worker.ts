/**
 * Web Worker entry for off-main-thread export. Running the pipeline here keeps a
 * large export (1000 pages, thousands of objects, big images) from blocking the
 * UI thread. The canonical {@link DocumentState} is plain JSON (structured-
 * cloneable) and the source PDF is transferred as an ArrayBuffer, so there is no
 * serialization cost beyond the transfer itself.
 *
 * Spawn it via `worker-client.ts` rather than importing this file directly.
 *
 * Protocol:
 *   → { type: "run", id, document, source?, options? }
 *   ← { type: "progress", id, progress, stage }
 *   ← { type: "done", id, result }            (result.bytes transferred back)
 *   ← { type: "error", id, code, message }
 */
import { ExportPipeline } from "./pipeline";
import { ExportError, errorMessage } from "./errors";
import type { ExportInput, ExportResult } from "./types";

// `lib` here is "dom" only; describe just the worker globals we use and cast.
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}
const scope = self as unknown as WorkerScope;

interface RunMessage {
  type: "run";
  id: string;
  document: ExportInput["document"];
  source?: ArrayBuffer | null;
  options?: Omit<NonNullable<ExportInput["options"]>, "signal" | "onProgress">;
}

const pipeline = new ExportPipeline();

scope.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as RunMessage;
  if (!data || data.type !== "run") return;
  void handleRun(data);
});

async function handleRun(msg: RunMessage): Promise<void> {
  try {
    const result = await pipeline.run({
      document: msg.document,
      source: msg.source ?? null,
      options: {
        ...msg.options,
        onProgress: (progress, stage) => scope.postMessage({ type: "progress", id: msg.id, progress, stage }),
      },
    });
    // Strip the Blob (not transferable/needed) and transfer the bytes buffer.
    const transferable: ExportResult = { ...result, blob: undefined };
    scope.postMessage({ type: "done", id: msg.id, result: transferable }, [result.bytes.buffer]);
  } catch (err) {
    const code = err instanceof ExportError ? err.code : "UNKNOWN";
    scope.postMessage({ type: "error", id: msg.id, code, message: errorMessage(err) });
  }
}
