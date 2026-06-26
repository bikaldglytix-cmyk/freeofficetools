"use client";

import { useEffect, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { extractPageText, textExtractionCache } from "@/lib/pdf/text/extraction";
import type { ExtractedTextPage } from "@/lib/pdf/text/types";

export interface UseTextExtractionParams {
  page: PDFPageProxy | null;
  documentId: string | null;
  pageId: string | null;
  pageIndex: number;
  enabled: boolean;
}

/**
 * Lazily extract a page's native text blocks via PDF.js, memoized per
 * document+page in the shared {@link textExtractionCache} so re-mounting a page
 * (virtualized scroll) never re-parses it. State is only written from the async
 * resolution (never synchronously in the effect body), keeping it clear of
 * React 19's `react-hooks/set-state-in-effect` rule. Returns null until ready.
 */
export function useTextExtraction({
  page,
  documentId,
  pageId,
  pageIndex,
  enabled,
}: UseTextExtractionParams): { extracted: ExtractedTextPage | null } {
  const [extracted, setExtracted] = useState<ExtractedTextPage | null>(null);

  useEffect(() => {
    if (!enabled || !page || !documentId || !pageId) return;
    const key = `${documentId}:${pageId}`;
    let cancelled = false;
    let promise = textExtractionCache.get(key);
    if (!promise) {
      promise = extractPageText({ page, documentId, pageId, pageIndex });
      textExtractionCache.set(key, promise);
    }
    promise
      .then((result) => {
        if (!cancelled) setExtracted(result);
      })
      .catch(() => {
        if (!cancelled) setExtracted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, page, documentId, pageId, pageIndex]);

  return { extracted };
}
