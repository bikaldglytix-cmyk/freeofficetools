/**
 * Integration helpers that wire the Export Engine to the rest of the editor:
 * the document store (State Engine), the event bus, and the browser download
 * path. These keep call sites tiny and ensure export always reads the canonical
 * model — never UI state.
 */
import type { StoreApi } from "zustand/vanilla";
import { documentStore } from "../store/document-store";
import type { DocumentStore } from "../store/types";
import { ExportError } from "./errors";
import { ExportManager, getExportManager } from "./manager";
import type { ExportOptions, ExportResult } from "./types";

/**
 * Export the document currently held in the store.
 *
 * @param source Original PDF bytes (kept by the viewer/loader). Without it,
 *               original page content can't be preserved — see ExportInput.
 */
export async function exportCurrentDocument(
  source: ArrayBuffer | Uint8Array | null,
  options?: ExportOptions,
  store: StoreApi<DocumentStore> = documentStore,
  manager?: ExportManager,
): Promise<ExportResult> {
  const state = store.getState();
  const document = state.document;
  if (!document) throw new ExportError("INVALID_STATE", "No document is open to export.");
  const mgr = manager ?? getExportManager(state.events);
  return mgr.exportNow({ document, source, options });
}

/**
 * Trigger a browser download of an export result. No-op (returns false) outside
 * the browser. The object URL is revoked after a tick so memory is released.
 */
export function triggerDownload(result: ExportResult): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  const blob = result.blob ?? new Blob([result.bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/** Convenience: export the current document and immediately download it. */
export async function exportAndDownload(
  source: ArrayBuffer | Uint8Array | null,
  options?: ExportOptions,
): Promise<ExportResult> {
  const result = await exportCurrentDocument(source, options);
  triggerDownload(result);
  return result;
}
