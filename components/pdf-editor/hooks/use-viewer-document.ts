"use client";

import { useEffect, useState } from "react";
import { loadViewerDocument } from "@/lib/pdf/viewer/document";
import type { ViewerDocument } from "@/lib/pdf/viewer/types";

export type DocumentStatus = "idle" | "loading" | "ready" | "error";

export interface UseViewerDocument {
  doc: ViewerDocument | null;
  status: DocumentStatus;
  error: string | null;
}

/**
 * Load a `File` into a `ViewerDocument`, owning its lifecycle: a new file
 * supersedes the old one, and the pdf.js worker resources are released on
 * unmount or when the file changes.
 */
export function useViewerDocument(file: File | null): UseViewerDocument {
  const [doc, setDoc] = useState<ViewerDocument | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Synchronizing with pdf.js (an external system); resetting status when the
    // file changes is intentional. Scope the lint exception narrowly.
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    let loaded: ViewerDocument | null = null;

    if (!file) {
      setDoc(null);
      setStatus("idle");
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);
    setDoc(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    loadViewerDocument(file)
      .then((d) => {
        if (cancelled) {
          void d.destroy();
          return;
        }
        loaded = d;
        setDoc(d);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't open this PDF. It may be corrupted or password-protected.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [file]);

  return { doc, status, error };
}
