"use client";

/**
 * Bridges the editor UI to the Export Engine (`lib/pdf/editor/export`).
 *
 * The engine turns the canonical document model plus the *original* PDF bytes
 * into a final, downloadable PDF — flattening annotations, text edits, drawings
 * and signatures onto the pages. Everything runs in the browser, so the file
 * never leaves the device. We re-read the bytes from the `File` at export time
 * (a fresh `arrayBuffer()` each call) so pdf.js detaching its copy never matters.
 */
import { useCallback, useRef, useState } from "react";
import { exportCurrentDocument, triggerDownload } from "@/lib/pdf/editor/export";
import { documentStore } from "@/lib/pdf/editor/store/document-store";

export type ExportPhase = "idle" | "working" | "done" | "error";

export interface PdfExport {
  /** Build the edited PDF and trigger a browser download. */
  download: () => Promise<void>;
  phase: ExportPhase;
  /** 0–100 while working. */
  progress: number;
  error: string | null;
}

export function usePdfExport(file: File | null): PdfExport {
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const download = useCallback(async () => {
    if (!file || busy.current) return;
    busy.current = true;
    setPhase("working");
    setProgress(0);
    setError(null);
    try {
      const source = await file.arrayBuffer();
      const result = await exportCurrentDocument(source, {
        fileName: downloadName(file.name),
        onProgress: (p) => setProgress(Math.min(100, Math.round(p * 100))),
      });
      triggerDownload(result);
      documentStore.getState().markSaved();
      setPhase("done");
      window.setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't export this PDF.");
      setPhase("error");
    } finally {
      busy.current = false;
    }
  }, [file]);

  return { download, phase, progress, error };
}

/** "report.pdf" -> "report-edited.pdf"; keeps a sensible default otherwise. */
function downloadName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").trim() || "document";
  return `${base}-edited.pdf`;
}
