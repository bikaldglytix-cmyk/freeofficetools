"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEditorDocument } from "@/components/pdf-editor/hooks/use-editor-document";
import { useScrollMetrics } from "@/components/pdf-editor/hooks/use-scroll-metrics";
import { usePan } from "@/components/pdf-editor/hooks/use-pan";
import { AnnotationToolbar } from "@/components/pdf-editor/annotations/annotation-toolbar";
import { deleteSelectedAnnotations } from "@/components/pdf-editor/annotations/annotation-layer";
import { TextEditToolbar } from "@/components/pdf-editor/text";
import type { TextTool } from "@/components/pdf-editor/text";
import type { AnnotationTool } from "@/lib/pdf/annotations";
import { usePdfSearch } from "@/components/pdf-editor/hooks/use-pdf-search";
import {
  computeLayout,
  visiblePageRange,
  currentPageAt,
  stepZoom,
  fitZoom,
  clampZoom,
  captureAnchor,
  resolveAnchor,
} from "@/lib/pdf/viewer/geometry";
import type { ViewerLayout } from "@/lib/pdf/viewer/types";
import { cn } from "@/lib/utils";
import { ViewerToolbar } from "./viewer-toolbar";
import { ThumbnailSidebar } from "./thumbnail-sidebar";
import { PdfPage } from "./pdf-page";
import { SearchPanel } from "./search-panel";

const PAGE_GAP = 16;
const PAGE_PADDING = 24;
const OVERSCAN = 1;

const EMPTY_LAYOUT: ViewerLayout = { pages: [], totalHeight: 0, totalWidth: 0 };

/**
 * Phase 1 PDF viewer: virtualized multi-page rendering with zoom, pan, search,
 * a thumbnail sidebar and a selectable text layer. Self-contained and client
 * only; all state lives here for now and will be lifted into the document store
 * in Phase 2 without changing this component's child APIs.
 */
export function PdfViewer({ file }: { file: File }) {
  const { doc, status, error } = useEditorDocument(file);

  // `scrollEl` (state) drives subscriptions (metrics/pan re-run when it mounts);
  // `scrollRef` is the same node for imperative scroll mutations, which must not
  // be done through a useState value.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollNode = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollEl(node);
  }, []);
  const metrics = useScrollMetrics(scrollEl);

  const [zoom, setZoom] = useState(1);
  const [handTool, setHandTool] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("select");
  const [textTool, setTextTool] = useState<TextTool>("off");

  const search = usePdfSearch(doc);
  const { panCursorActive, panning } = usePan(scrollEl, handTool);

  // ----- Layout + virtualization (derived) -------------------------------
  const layout = useMemo<ViewerLayout>(() => {
    if (!doc || metrics.viewportWidth === 0) return EMPTY_LAYOUT;
    return computeLayout(doc.pageSizes, {
      zoom,
      gap: PAGE_GAP,
      containerWidth: metrics.viewportWidth,
      padding: PAGE_PADDING,
    });
  }, [doc, zoom, metrics.viewportWidth]);

  const range = useMemo(
    () => visiblePageRange(layout, metrics.scrollTop, metrics.viewportHeight, OVERSCAN),
    [layout, metrics.scrollTop, metrics.viewportHeight],
  );
  const currentPage = useMemo(
    () => currentPageAt(layout, metrics.scrollTop, metrics.viewportHeight),
    [layout, metrics.scrollTop, metrics.viewportHeight],
  );

  // ----- Initial fit-to-width once the document + viewport are known -----
  const initializedRef = useRef(false);
  useEffect(() => {
    initializedRef.current = false;
  }, [doc]);
  useEffect(() => {
    if (!doc || metrics.viewportWidth === 0 || initializedRef.current) return;
    initializedRef.current = true;
    setZoom(fitZoom(doc.pageSizes[0], "width", metrics.viewportWidth, metrics.viewportHeight, PAGE_PADDING));
  }, [doc, metrics.viewportWidth, metrics.viewportHeight]);

  // ----- Zoom with scroll anchoring --------------------------------------
  const anchorRef = useRef<{ page: number; fraction: number } | null>(null);

  const applyZoom = useCallback(
    (next: number) => {
      anchorRef.current = captureAnchor(layout, metrics.scrollTop, currentPage);
      setZoom(clampZoom(next));
    },
    [layout, metrics.scrollTop, currentPage],
  );

  // Restore the anchored scroll position after the new layout is committed.
  // Mutate through the ref (not the useState node) to keep the scroll write
  // out of React's state model.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !anchorRef.current || layout.pages.length === 0) return;
    el.scrollTop = resolveAnchor(layout, anchorRef.current);
    anchorRef.current = null;
  }, [layout]);

  const scrollToPage = useCallback(
    (index: number) => {
      const page = layout.pages[index];
      if (!scrollEl || !page) return;
      scrollEl.scrollTo({ top: Math.max(0, page.top - PAGE_PADDING) });
    },
    [layout, scrollEl],
  );

  const fitWidth = useCallback(() => {
    if (!doc) return;
    applyZoom(fitZoom(doc.pageSizes[currentPage], "width", metrics.viewportWidth, metrics.viewportHeight, PAGE_PADDING));
  }, [doc, currentPage, metrics.viewportWidth, metrics.viewportHeight, applyZoom]);

  const fitPage = useCallback(() => {
    if (!doc) return;
    applyZoom(fitZoom(doc.pageSizes[currentPage], "page", metrics.viewportWidth, metrics.viewportHeight, PAGE_PADDING));
  }, [doc, currentPage, metrics.viewportWidth, metrics.viewportHeight, applyZoom]);

  // ----- Search: scroll the active match into view -----------------------
  const activeId = search.active?.id ?? null;
  useEffect(() => {
    const active = search.active;
    if (!active || !scrollEl) return;
    const page = layout.pages[active.pageIndex];
    if (!page) return;
    const rectTop = active.rects[0]?.y ?? 0;
    scrollEl.scrollTo({
      top: Math.max(0, page.top + rectTop * zoom - metrics.viewportHeight * 0.3),
      behavior: "smooth",
    });
    // Intentionally keyed on the active match id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ----- Keyboard: Ctrl/Cmd+F to find, Esc to close ----------------------
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    search.clear();
  }, [search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ----- Render ----------------------------------------------------------
  if (status === "error") {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 p-10 text-center">
        <AlertTriangle className="size-7 text-destructive" />
        <p className="text-sm font-medium text-foreground">Couldn&apos;t open this PDF</p>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const ready = status === "ready" && doc;

  return (
    <div className="pdf-editor-viewer flex h-full min-h-0 flex-col">
      {ready ? (
        <ViewerToolbar
          zoom={zoom}
          onZoomIn={() => applyZoom(stepZoom(zoom, 1))}
          onZoomOut={() => applyZoom(stepZoom(zoom, -1))}
          onResetZoom={() => applyZoom(1)}
          onFitWidth={fitWidth}
          onFitPage={fitPage}
          currentPage={currentPage}
          numPages={doc.numPages}
          onGoToPage={scrollToPage}
          handToolActive={handTool}
          onToggleHand={() => setHandTool((v) => !v)}
          searchOpen={searchOpen}
          onToggleSearch={() => (searchOpen ? closeSearch() : openSearch())}
        />
      ) : null}
      {ready ? (
        <AnnotationToolbar
          tool={annotationTool}
          onToolChange={(next) => {
            setAnnotationTool(next);
            if (handTool) setHandTool(false);
            if (textTool !== "off") setTextTool("off");
          }}
          onDeleteSelection={deleteSelectedAnnotations}
        />
      ) : null}
      {ready ? (
        <TextEditToolbar
          tool={textTool}
          onToolChange={(next) => {
            setTextTool(next);
            if (next !== "off") {
              if (handTool) setHandTool(false);
              setAnnotationTool("select");
            }
          }}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {ready ? (
          <ThumbnailSidebar doc={doc} currentPage={currentPage} onSelect={scrollToPage} />
        ) : null}

        {/* Scroll viewport */}
        <div
          ref={setScrollNode}
          tabIndex={0}
          className={cn(
            "relative min-h-0 flex-1 overflow-auto bg-muted/40 outline-none",
            panning ? "cursor-grabbing" : panCursorActive ? "cursor-grab" : "cursor-auto",
            panCursorActive && "select-none",
          )}
        >
          {!ready ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" /> Opening document…
              </span>
            </div>
          ) : (
            <div className="relative mx-auto" style={{ height: layout.totalHeight, width: layout.totalWidth }}>
              {layout.pages.map((p) =>
                range.start !== -1 && p.index >= range.start && p.index <= range.end ? (
                  <PdfPage
                    key={p.index}
                    doc={doc}
                    layout={p}
                    zoom={zoom}
                    matches={search.matchesByPage.get(p.index) ?? EMPTY_MATCHES}
                    activeMatchId={activeId}
                    handToolActive={panCursorActive}
                    annotationTool={annotationTool}
                    annotationsEnabled={!panCursorActive && textTool === "off"}
                    textTool={textTool}
                  />
                ) : null,
              )}
            </div>
          )}
        </div>

        {/* Find bar: anchored to the non-scrolling container so it stays put. */}
        {searchOpen && ready ? (
          <SearchPanel
            query={search.query}
            onQueryChange={search.setQuery}
            status={search.status}
            matchCount={search.matches.length}
            activeIndex={search.activeIndex}
            onNext={search.next}
            onPrev={search.prev}
            onClose={closeSearch}
          />
        ) : null}
      </div>
    </div>
  );
}

// Stable empty array so memoized pages don't re-render when a page has no matches.
const EMPTY_MATCHES: never[] = [];
