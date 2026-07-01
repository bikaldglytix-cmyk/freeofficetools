/**
 * Web Worker that runs PDF operations off the main thread so heavy work
 * (pdf-lib saves on large documents, full-page rasterization, image
 * recompression) never freezes the UI.
 *
 * Files are structured-cloned in (Blob storage is shared, not copied) and the
 * result — whose outputs are Blobs — is cloned back the same way, so there's no
 * ArrayBuffer bookkeeping to do here. Dispatch goes through the shared op
 * registry (`pdf-ops.ts`) so this path is identical to the main-thread fallback.
 *
 * Spawn it via `pdf-worker-client.ts`; never import this file directly.
 *
 * Protocol (every request carries a client-assigned numeric `id`):
 *   → { type: "run", id, op, files, options }
 *   ← { type: "progress", id, fraction }     (0..1, may arrive many times)
 *   ← { type: "result", id, result }
 *   ← { type: "error", id, message }
 */
import { runPdfOpInline, type PdfOp } from "./pdf-ops";

// `lib` is "dom" only; describe just the worker globals we touch and cast.
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}
const scope = self as unknown as WorkerScope;

interface RunMessage {
  type: "run";
  id: number;
  op: PdfOp;
  files: File[];
  options: unknown;
}

scope.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as RunMessage;
  if (!data || data.type !== "run") return;
  void handleRun(data);
});

async function handleRun(msg: RunMessage): Promise<void> {
  try {
    const result = await runPdfOpInline(msg.op, msg.files, msg.options, {
      onProgress: (fraction) => scope.postMessage({ type: "progress", id: msg.id, fraction }),
    });
    scope.postMessage({ type: "result", id: msg.id, result });
  } catch (err) {
    scope.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error && err.message ? err.message : String(err),
    });
  }
}
