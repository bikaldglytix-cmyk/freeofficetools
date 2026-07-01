"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEditorDocument } from "@/components/pdf-editor/hooks/use-editor-document";
import { useScrollMetrics } from "@/components/pdf-editor/hooks/use-scroll-metrics";
import { usePan } from "@/components/pdf-editor/hooks/use-pan";
import { usePdfExport } from "@/components/pdf-editor/hooks/use-pdf-export";
import { EditorToolbar, type EditorMode } from "@/components/pdf-editor/toolbar/editor-toolbar";
import { SignatureDialog, type SignatureSpec } from "@/components/pdf-editor/signature/signature-dialog";
import type { TextTool } from "@/components/pdf-editor/text";
import { fileToImageSpec, replaceSelectedImage } from "@/components/pdf-editor/image/image-actions";
import { addAnnotationOperation, createSignatureAnnotation, type AnnotationTool } from "@/lib/pdf/annotations";
import { warmRedaction } from "@/lib/pdf/editor/live/redact-page";
import { createImageObject } from "@/lib/pdf/editor/model/factory";
import { ops } from "@/lib/pdf/editor/operations/types";
import { documentStore } from "@/lib/pdf/editor/store/document-store";
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
const COMPACT_BREAKPOINT = 760;

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
  // This is the "Edit PDF" tool, so open straight into text-editing: every line
  // is immediately outlined and clickable, instead of hiding editing behind a
  // "View" default the user has to discover. They can switch to View to just read.
  const [mode, setMode] = useState<EditorMode>("text");
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("select");
  const [textTool, setTextTool] = useState<TextTool>("select");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageAction = useRef<"insert" | "replace">("insert");

  // Switching editing mode maps the high-level choice down to the concrete tool
  // states the layers read. Tools are remembered per mode where it makes sense
  // (e.g. re-entering Draw keeps your last shape), defaulting otherwise.
  const selectMode = useCallback((next: EditorMode) => {
    setMode(next);
    setHandTool(false);
    if (next === "text") {
      setAnnotationTool("select");
      setTextTool((t) => (t === "off" ? "select" : t));
      return;
    }
    setTextTool("off");
    setAnnotationTool((t) => defaultAnnotationToolFor(next, t));
  }, []);

  const search = usePdfSearch(doc);
  const { panCursorActive, panning } = usePan(scrollEl, handTool);
  const exporter = usePdfExport(file);
  const compactViewer = metrics.viewportWidth > 0 && metrics.viewportWidth < COMPACT_BREAKPOINT;
  const pagePadding = compactViewer ? 12 : PAGE_PADDING;
  const pageGap = compactViewer ? 10 : PAGE_GAP;

  // ----- Layout + virtualization (derived) -------------------------------
  const layout = useMemo<ViewerLayout>(() => {
    if (!doc || metrics.viewportWidth === 0) return EMPTY_LAYOUT;
    return computeLayout(doc.pageSizes, {
      zoom,
      gap: pageGap,
      containerWidth: metrics.viewportWidth,
      padding: pagePadding,
    });
  }, [doc, zoom, metrics.viewportWidth, pageGap, pagePadding]);

  const visibleRange = useMemo(
    () => visiblePageRange(layout, metrics.scrollTop, metrics.viewportHeight, 0),
    [layout, metrics.scrollTop, metrics.viewportHeight],
  );
  const range = useMemo(
    () => visiblePageRange(layout, metrics.scrollTop, metrics.viewportHeight, compactViewer ? 0 : OVERSCAN),
    [layout, metrics.scrollTop, metrics.viewportHeight, compactViewer],
  );
  const currentPage = useMemo(
    () => currentPageAt(layout, metrics.scrollTop, metrics.viewportHeight),
    [layout, metrics.scrollTop, metrics.viewportHeight],
  );

  // Picking "Signature" opens the custom signature box instead of a browser
  // prompt; every other annotation tool arms as usual.
  const onPickAnnotationTool = useCallback((t: AnnotationTool) => {
    if (t === "signature") {
      setSignatureOpen(true);
      return;
    }
    setAnnotationTool(t);
  }, []);

  // Place the built signature ONCE on the current page, select it for dragging,
  // then drop back to the select tool so clicking elsewhere never re-stamps it.
  const placeSignature = useCallback(
    (spec: SignatureSpec) => {
      const store = documentStore.getState();
      const model = store.document;
      const pageId = model?.pageOrder[currentPage];
      if (!model || !pageId) return;
      const size = model.pages[pageId]?.size ?? { width: 612, height: 792 };
      const w = 220;
      const h = spec.mode === "image" ? 96 : 72;
      // Drop it in the middle of what's currently on screen so it's never placed
      // off-view (page geometry is in scaled px; divide by zoom for page points).
      const page = layout.pages[currentPage];
      const viewCenterPt = page
        ? (metrics.scrollTop + metrics.viewportHeight / 2 - page.top) / zoom
        : size.height / 2;
      const rect = {
        x: Math.max(0, (size.width - w) / 2),
        y: Math.min(Math.max(0, viewCenterPt - h / 2), Math.max(0, size.height - h)),
        width: w,
        height: h,
      };
      const ctx = { documentId: model.meta.id, pageId, author: model.meta.author };
      const annotation =
        spec.mode === "typed"
          ? createSignatureAnnotation(ctx, rect, { mode: "typed", text: spec.text, fontFamily: spec.fontFamily, stroke: spec.color })
          : createSignatureAnnotation(ctx, rect, { mode: "image", src: spec.src });
      const op = addAnnotationOperation(annotation);
      store.dispatch(op);
      const id = op.type === "ADD_SIGNATURE" || op.type === "ADD_ANNOTATION" ? op.object.id : null;
      if (id) store.select(pageId, [id]);
      setSignatureOpen(false);
      setAnnotationTool("select");
    },
    [currentPage, layout, metrics.scrollTop, metrics.viewportHeight, zoom],
  );

  // Insert a picked image, sized to fit and centred in the current view (mirrors
  // placeSignature). Everything stays a client-side data URL.
  const insertImage = useCallback(
    async (file: File) => {
      const spec = await fileToImageSpec(file);
      const store = documentStore.getState();
      const model = store.document;
      const pageId = model?.pageOrder[currentPage];
      if (!model || !pageId) return;
      const size = model.pages[pageId]?.size ?? { width: 612, height: 792 };
      const w = Math.min(260, size.width * 0.6, spec.naturalWidth);
      const h = w * (spec.naturalHeight / Math.max(1, spec.naturalWidth));
      const page = layout.pages[currentPage];
      const viewCenterPt = page ? (metrics.scrollTop + metrics.viewportHeight / 2 - page.top) / zoom : size.height / 2;
      const rect = {
        x: Math.max(0, (size.width - w) / 2),
        y: Math.min(Math.max(0, viewCenterPt - h / 2), Math.max(0, size.height - h)),
        width: w,
        height: h,
      };
      const obj = createImageObject({
        pageId,
        rect,
        src: spec.src,
        mimeType: spec.mimeType,
        naturalWidth: spec.naturalWidth,
        naturalHeight: spec.naturalHeight,
        actor: model.meta.author,
      });
      store.dispatch(ops.addImage(pageId, obj));
      store.select(pageId, [obj.id]);
    },
    [currentPage, layout, metrics.scrollTop, metrics.viewportHeight, zoom],
  );

  const openImagePicker = useCallback((action: "insert" | "replace") => {
    imageAction.current = action;
    imageInputRef.current?.click();
  }, []);

  const onImageFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-picking the same file
      if (!file) return;
      try {
        if (imageAction.current === "insert") await insertImage(file);
        else replaceSelectedImage(await fileToImageSpec(file));
      } catch {
        /* decode/read failure — ignore; the user can retry with another file */
      }
    },
    [insertImage],
  );

  // Pre-parse the source for live glyph removal during idle time, so the very
  // first text edit renders its cleaned page instantly instead of paying the
  // full-file pdf-lib parse right when the user starts typing.
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setTimeout(() => warmRedaction(file), 500);
    return () => window.clearTimeout(timer);
  }, [status, file]);

  // ----- Initial fit-to-width once the document + viewport are known -----
  const initializedRef = useRef(false);
  useEffect(() => {
    initializedRef.current = false;
  }, [doc]);
  useEffect(() => {
    if (!doc || metrics.viewportWidth === 0 || initializedRef.current) return;
    initializedRef.current = true;
    setZoom(fitZoom(doc.pageSizes[0], "width", metrics.viewportWidth, metrics.viewportHeight, pagePadding));
  }, [doc, metrics.viewportWidth, metrics.viewportHeight, pagePadding]);

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
      scrollEl.scrollTo({ top: Math.max(0, page.top - pagePadding) });
    },
    [layout, pagePadding, scrollEl],
  );

  const fitWidth = useCallback(() => {
    if (!doc) return;
    applyZoom(fitZoom(doc.pageSizes[currentPage], "width", metrics.viewportWidth, metrics.viewportHeight, pagePadding));
  }, [doc, currentPage, metrics.viewportWidth, metrics.viewportHeight, pagePadding, applyZoom]);

  const fitPage = useCallback(() => {
    if (!doc) return;
    applyZoom(fitZoom(doc.pageSizes[currentPage], "page", metrics.viewportWidth, metrics.viewportHeight, pagePadding));
  }, [doc, currentPage, metrics.viewportWidth, metrics.viewportHeight, pagePadding, applyZoom]);

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
  const showThumbnails = ready && !compactViewer && doc.numPages > 1;

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
          onDownload={exporter.download}
          downloadPhase={exporter.phase}
          downloadProgress={exporter.progress}
        />
      ) : null}
      {ready ? (
        <EditorToolbar
          mode={mode}
          onModeChange={selectMode}
          annotationTool={annotationTool}
          onAnnotationToolChange={onPickAnnotationTool}
          textTool={textTool}
          onTextToolChange={setTextTool}
          onInsertImage={() => openImagePicker("insert")}
          onReplaceImage={() => openImagePicker("replace")}
        />
      ) : null}

      {/* Hidden picker shared by Insert/Replace image. */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onImageFileChange}
      />

      {signatureOpen ? (
        <SignatureDialog
          onClose={() => {
            setSignatureOpen(false);
            setAnnotationTool("select");
          }}
          onConfirm={placeSignature}
        />
      ) : null}

      {exporter.phase === "error" && exporter.error ? (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">Download failed: {exporter.error}</span>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {showThumbnails ? (
          <ThumbnailSidebar doc={doc} currentPage={currentPage} onSelect={scrollToPage} />
        ) : null}

        {/* Scroll viewport */}
        <div
          ref={setScrollNode}
          tabIndex={0}
          className={cn(
            "relative min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/40 outline-none",
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
                    sourceFile={file}
                    layout={p}
                    zoom={zoom}
                    matches={search.matchesByPage.get(p.index) ?? EMPTY_MATCHES}
                    activeMatchId={activeId}
                    handToolActive={panCursorActive}
                    annotationTool={annotationTool}
                    annotationsEnabled={!panCursorActive && textTool === "off"}
                    textTool={textTool}
                    interactive={
                      visibleRange.start !== -1 && p.index >= visibleRange.start && p.index <= visibleRange.end
                    }
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

const MODE_TOOL_GROUPS: Record<"annotate" | "draw" | "sign", AnnotationTool[]> = {
  annotate: ["highlight", "comment", "sticky-note"],
  draw: ["draw", "rectangle", "circle", "line", "arrow"],
  sign: ["signature", "stamp"],
};

/** The annotation tool a mode should arm: keep the current one if it belongs to
 *  the mode, otherwise fall back to the mode's first tool. */
function defaultAnnotationToolFor(mode: EditorMode, current: AnnotationTool): AnnotationTool {
  // View/Text/Image/Sign all arm "select": Image lets you click+drag existing
  // pictures (insert is an explicit button); Sign opens the signature box on a
  // button so a stray page click can't drop anything.
  if (mode === "view" || mode === "text" || mode === "image" || mode === "sign") return "select";
  const group = MODE_TOOL_GROUPS[mode];
  return group.includes(current) ? current : group[0];
}
