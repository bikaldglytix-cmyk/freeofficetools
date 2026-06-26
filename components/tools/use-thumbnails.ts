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
        if (!cancelled) setThumbs(t);
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

  return { thumbs, loading, error };
}
