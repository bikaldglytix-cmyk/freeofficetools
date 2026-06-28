"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { AnnotationLayer } from "@/components/pdf-editor/annotations/annotation-layer";
import { TextEditLayer, type TextTool } from "@/components/pdf-editor/text";
import { useDocument } from "@/lib/pdf/editor/store/hooks";
import { pageIdForSourceIndex } from "@/lib/pdf/editor/integration/from-viewer";
import type { AnnotationTool } from "@/lib/pdf/annotations";
import { renderPage, type PageRenderHandle } from "@/lib/pdf/viewer/render";
import type { PageLayout, SearchMatch, ViewerDocument } from "@/lib/pdf/viewer/types";
import { PdfTextLayer } from "./pdf-text-layer";

interface PdfPageProps {
  doc: ViewerDocument;
  layout: PageLayout;
  zoom: number;
  matches: SearchMatch[];
  activeMatchId: string | null;
  handToolActive: boolean;
  annotationTool: AnnotationTool;
  annotationsEnabled: boolean;
  textTool: TextTool;
}

/**
 * A single rendered page, absolutely positioned within the scroll content.
 * Only mounted while in/near the viewport (parent handles virtualization). On
 * mount or zoom change it fetches its page proxy, paints the canvas, mounts the
 * text layer, and overlays any search highlights. In-flight renders are
 * canceled on cleanup so fast scroll/zoom never leaks work.
 */
function PdfPageImpl({ doc, layout, zoom, matches, activeMatchId, handToolActive, annotationTool, annotationsEnabled, textTool }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [rendered, setRendered] = useState(false);
  const editorDocument = useDocument();
  const pageId = editorDocument ? pageIdForSourceIndex(editorDocument, layout.index) ?? null : null;
  const setPageNode = useCallback((node: HTMLDivElement | null) => {
    pageRef.current = node;
    setPageEl(node);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let handle: PageRenderHandle | null = null;
    // Reset the "rendered" flag when (re)rendering this page; this synchronizes
    // with pdf.js (an external system), so the scoped exception is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRendered(false);

    doc
      .getPage(layout.index)
      .then((p) => {
        if (cancelled || !canvasRef.current) return;
        setPage(p);
        handle = renderPage(p, canvasRef.current, zoom);
        return handle.promise;
      })
      .then(() => {
        if (!cancelled) setRendered(true);
      })
      .catch(() => {
        /* canceled or failed render — leave the white page box in place */
      });

    return () => {
      cancelled = true;
      handle?.cancel();
    };
  }, [doc, layout.index, zoom]);

  return (
    <div
      ref={setPageNode}
      data-page-index={layout.index}
      className="group/page absolute rounded-sm bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-1 ring-black/10"
      style={{
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height: layout.height,
      }}
    >
      <canvas ref={canvasRef} className="block" style={{ width: layout.width, height: layout.height }} />

      {/* Search highlights: scale-1 rects scaled by zoom; never block selection. */}
      {matches.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {matches.flatMap((m) =>
            m.rects.map((r, i) => (
              <div
                key={`${m.id}:${i}`}
                className="absolute rounded-[1px]"
                style={{
                  left: r.x * zoom,
                  top: r.y * zoom,
                  width: r.width * zoom,
                  height: r.height * zoom,
                  backgroundColor:
                    m.id === activeMatchId ? "rgba(255,150,0,0.45)" : "rgba(255,214,0,0.38)",
                  outline: m.id === activeMatchId ? "1px solid rgba(220,120,0,0.9)" : "none",
                }}
              />
            )),
          )}
        </div>
      ) : null}

      {page ? (
        <div className="absolute inset-0 z-[2]">
          <PdfTextLayer page={page} zoom={zoom} selectable={!handToolActive} />
        </div>
      ) : null}

      <div className={annotationsEnabled ? "" : "pointer-events-none"}>
        <AnnotationLayer
          pageId={pageId}
          pageIndex={layout.index}
          width={layout.width}
          height={layout.height}
          zoom={zoom}
          tool={annotationTool}
          pageElement={pageEl}
        />
      </div>

      <TextEditLayer
        pageId={pageId}
        pageIndex={layout.index}
        page={page}
        width={layout.width}
        height={layout.height}
        zoom={zoom}
        // While the hand tool / space-pan is active, the text layer must be inert
        // so pointer events reach the scroll container and panning works (the
        // layer sits above the page at z-[4] and otherwise swallows the drag).
        tool={handToolActive ? "off" : textTool}
        pageElement={pageEl}
      />

      {/* Page number badge */}
      <span className="pointer-events-none absolute -top-px left-1/2 z-[3] -translate-x-1/2 -translate-y-full rounded-t bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/page:opacity-100">
        {layout.index + 1}
      </span>

      {!rendered ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-black/30">
          {layout.index + 1}
        </span>
      ) : null}
    </div>
  );
}

export const PdfPage = memo(PdfPageImpl);
