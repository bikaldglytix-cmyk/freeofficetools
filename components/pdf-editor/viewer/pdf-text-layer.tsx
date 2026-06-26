"use client";

import { useEffect, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { renderTextLayer, type TextLayerHandle } from "@/lib/pdf/viewer/text-layer";

/**
 * Selectable text overlay for one page. The `textLayer` class is required —
 * pdf.js positions its spans against the CSS in `app/globals.css`. Selection is
 * disabled while the hand tool pans so dragging doesn't select glyphs.
 */
export function PdfTextLayer({
  page,
  zoom,
  selectable,
}: {
  page: PDFPageProxy;
  zoom: number;
  selectable: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let handle: TextLayerHandle | null = null;

    renderTextLayer(page, el, zoom)
      .then((h) => {
        if (cancelled) h.cancel();
        else handle = h;
      })
      .catch(() => {
        /* a failed text layer should never break the page render */
      });

    return () => {
      cancelled = true;
      handle?.cancel();
      el.replaceChildren();
    };
  }, [page, zoom]);

  return (
    <div
      ref={ref}
      className="textLayer"
      style={{ pointerEvents: selectable ? "auto" : "none" }}
    />
  );
}
