"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { AnnotationLayer } from "@/components/pdf-editor/annotations/annotation-layer";
import { TextEditLayer, type TextTool } from "@/components/pdf-editor/text";
import { useDocument, usePageObjects } from "@/lib/pdf/editor/store/hooks";
import { pageIdForSourceIndex } from "@/lib/pdf/editor/integration/from-viewer";
import type { AnnotationTool } from "@/lib/pdf/annotations";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { buildRedactedPage, regionSetKey, type RedactedPage } from "@/lib/pdf/editor/live/redact-page";
import { storedWhiteoutBounds } from "@/lib/pdf/text/whiteout";
import { renderPage, type PageRenderHandle } from "@/lib/pdf/viewer/render";
import type { PageLayout, SearchMatch, ViewerDocument } from "@/lib/pdf/viewer/types";
import { PdfTextLayer } from "./pdf-text-layer";

interface PdfPageProps {
  doc: ViewerDocument;
  /** The opened file — source bytes for live glyph removal on edited pages. */
  sourceFile: File | null;
  layout: PageLayout;
  zoom: number;
  matches: SearchMatch[];
  activeMatchId: string | null;
  handToolActive: boolean;
  annotationTool: AnnotationTool;
  annotationsEnabled: boolean;
  textTool: TextTool;
  interactive: boolean;
}

const EMPTY_KEYS: ReadonlySet<string> = new Set();

/**
 * A single rendered page, absolutely positioned within the scroll content.
 * Only mounted while in/near the viewport (parent handles virtualization). On
 * mount or zoom change it fetches its page proxy, paints the canvas, mounts the
 * text layer, and overlays any search highlights. In-flight renders are
 * canceled on cleanup so fast scroll/zoom never leaks work.
 *
 * TRUE-REMOVAL RENDERING: when this page has edited original text, the canvas
 * is repainted from a copy of the page whose edited glyphs were deleted from
 * the content stream (see lib/pdf/editor/live/redact-page). The old words are
 * then genuinely absent from the raster — no white patches, no descender
 * debris, any background preserved. Masks in the text layer only bridge the
 * moment until that render lands (and the rare regions removal can't reach).
 */
function PdfPageImpl({
  doc,
  sourceFile,
  layout,
  zoom,
  matches,
  activeMatchId,
  handToolActive,
  annotationTool,
  annotationsEnabled,
  textTool,
  interactive,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [rendered, setRendered] = useState(false);
  // Bumped after every successful canvas paint so overlays can (re)sample it.
  const [paintVersion, setPaintVersion] = useState(0);
  const editorDocument = useDocument();
  const pageId = editorDocument ? pageIdForSourceIndex(editorDocument, layout.index) ?? null : null;
  const setPageNode = useCallback((node: HTMLDivElement | null) => {
    pageRef.current = node;
    setPageEl(node);
  }, []);

  // ----- Live glyph removal ------------------------------------------------
  // Regions needing removal: the stored original-glyph bounds of every edited
  // native text object, plus the line currently being edited inline (published
  // by the text layer before any operation is committed).
  const objects = usePageObjects(pageId ?? "");
  const [liveEditRect, setLiveEditRect] = useState<Rect | null>(null);
  const removalRects = useMemo(() => {
    const rects: Rect[] = [];
    for (const o of objects) {
      if (o.kind === "text" && o.source === "original") rects.push(...storedWhiteoutBounds(o.metadata));
    }
    if (liveEditRect) rects.push(liveEditRect);
    return rects;
  }, [objects, liveEditRect]);
  const removalKey = useMemo(() => regionSetKey(removalRects), [removalRects]);

  const [redacted, setRedacted] = useState<{ key: string; page: RedactedPage } | null>(null);

  useEffect(() => {
    if (!sourceFile || removalRects.length === 0) {
      // Drop the redacted raster when the last edit is undone; synchronizes
      // with an external resource (the pdf.js document being destroyed).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedacted((prev) => {
        prev?.page.destroy();
        return null;
      });
      return;
    }
    if (redacted?.key === removalKey) return;
    let cancelled = false;
    // Small debounce coalesces bursts (commit + reflow land as several store
    // updates) without making the first clean render feel laggy.
    const timer = setTimeout(async () => {
      const built = await buildRedactedPage({
        file: sourceFile,
        pageIndex: layout.index,
        rects: removalRects,
        pageHeightPt: doc.pageSizes[layout.index]?.height ?? layout.height / zoom,
        rotation: doc.pageSizes[layout.index]?.rotation ?? 0,
      });
      if (cancelled) {
        built?.destroy();
        return;
      }
      if (built) {
        setRedacted((prev) => {
          prev?.page.destroy();
          return { key: removalKey, page: built };
        });
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `redacted` is deliberately read but not depended on: a landed build sets
    // it to the same key this effect just built, and re-running would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFile, removalKey, removalRects, layout.index, doc]);

  // Release the last redacted document when the page unmounts (virtualization).
  const redactedRef = useRef(redacted);
  useEffect(() => {
    redactedRef.current = redacted;
  }, [redacted]);
  useEffect(() => () => redactedRef.current?.page.destroy(), []);

  // ----- Canvas painting ---------------------------------------------------
  // The original proxy is always fetched (the text layer and extraction need
  // it); the canvas paints the redacted copy instead whenever one is live.
  useEffect(() => {
    let cancelled = false;
    doc
      .getPage(layout.index)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch(() => {
        /* destroyed document — page stays blank */
      });
    return () => {
      cancelled = true;
    };
  }, [doc, layout.index]);

  useEffect(() => {
    const target = redacted?.page.proxy ?? page;
    if (!target || !canvasRef.current) return;
    setRendered(false);
    let cancelled = false;
    let handle: PageRenderHandle | null = null;
    try {
      handle = renderPage(target, canvasRef.current, zoom);
    } catch {
      return;
    }
    handle.promise
      .then(() => {
        if (cancelled) return;
        setRendered(true);
        setPaintVersion((v) => v + 1);
      })
      .catch(() => {
        /* canceled or failed render — leave the current raster in place */
      });
    return () => {
      cancelled = true;
      handle?.cancel();
    };
  }, [page, redacted, zoom]);

  return (
    <div
      ref={setPageNode}
      data-page-index={layout.index}
      className="group/page absolute rounded-sm bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-1 ring-black/10 [contain:layout_paint]"
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

      {page && interactive && textTool === "off" ? (
        <div className="absolute inset-0 z-[2]">
          <PdfTextLayer page={page} zoom={zoom} selectable={!handToolActive} />
        </div>
      ) : null}

      {interactive ? (
        <>
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
            cleanRectKeys={redacted?.page.cleanRectKeys ?? EMPTY_KEYS}
            onLiveEditRect={setLiveEditRect}
            paintVersion={paintVersion}
          />
        </>
      ) : null}

      {/* Page number badge */}
      <span className="pointer-events-none absolute -top-px left-1/2 z-[3] -translate-x-1/2 -translate-y-full rounded-t bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/page:opacity-100">
        {layout.index + 1}
      </span>

      {!rendered && paintVersion === 0 ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-black/30">
          {layout.index + 1}
        </span>
      ) : null}
    </div>
  );
}

export const PdfPage = memo(PdfPageImpl);
