"use client";

import { useEffect, useState } from "react";
import { renderThumbnails, type PageThumb } from "@/lib/pdf/thumbnails";

/** Render page thumbnails for a PDF, with loading/error state. */
export function usePageThumbnails(file: File | null) {
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This effect synchronizes with an external system (pdf.js rendering pages
    // off the main bundle). Resetting status synchronously when the file changes
    // is intentional, so the disable below is scoped and deliberate.
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    if (!file) {
      setThumbs([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setThumbs([]);
    /* eslint-enable react-hooks/set-state-in-effect */
    renderThumbnails(file)
      .then((t) => {
        // If this run was superseded, the thumbs are orphaned object URLs —
        // revoke them here since they'll never reach state (and thus the
        // revoke-on-replace effect below would never see them).
        if (cancelled) {
          for (const x of t) URL.revokeObjectURL(x.url);
          return;
        }
        setThumbs(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Object URLs pin their blobs in memory until revoked. Release the previous
  // batch whenever `thumbs` is replaced (new file / reset) and on unmount.
  useEffect(() => {
    return () => {
      for (const t of thumbs) URL.revokeObjectURL(t.url);
    };
  }, [thumbs]);

  return { thumbs, loading, error };
}
