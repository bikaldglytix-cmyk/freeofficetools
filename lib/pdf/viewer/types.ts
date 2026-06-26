/**
 * Shared types for the PDF Editor viewer engine (Phase 1).
 *
 * The viewer engine is deliberately framework-agnostic: these types describe a
 * loaded document, the geometry used to lay pages out and virtualize them, and
 * the search model. React hooks/components in `components/pdf-editor` consume
 * them but the engine itself never imports React.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

/** Intrinsic page size, measured once at scale 1 (CSS px), incl. the page's own rotation. */
export interface PageSize {
  /** Width in CSS px at zoom = 1, with the page's intrinsic rotation applied. */
  width: number;
  /** Height in CSS px at zoom = 1, with the page's intrinsic rotation applied. */
  height: number;
  /** The page's intrinsic rotation in degrees (0 | 90 | 180 | 270). */
  rotation: number;
}

/** A loaded document plus everything the UI needs to lay it out without re-fetching. */
export interface ViewerDocument {
  /** The underlying pdf.js document. Pages are fetched lazily and cached by pdf.js. */
  proxy: PDFDocumentProxy;
  numPages: number;
  /** Intrinsic page sizes at scale 1, 0-based. Used for layout + virtualization. */
  pageSizes: PageSize[];
  /** Fetch a page proxy by 0-based index. */
  getPage(index: number): Promise<PDFPageProxy>;
  /** Release the pdf.js worker resources for this document. */
  destroy(): Promise<void>;
}

/** Axis-aligned rectangle in *scale-1 viewport* coordinates (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One search hit, with pre-computed highlight rectangles in scale-1 coordinates. */
export interface SearchMatch {
  /** Stable id: `${pageIndex}:${start}`. */
  id: string;
  pageIndex: number;
  /** Char offset (inclusive) into the page's normalized text. */
  start: number;
  /** Char offset (exclusive). */
  end: number;
  /** Highlight rectangles (scale-1 coords); scaled by zoom at paint time. */
  rects: Rect[];
  /** Short surrounding text for the results list. */
  snippet: string;
}

/** Layout box for a single page within the scrollable content area. */
export interface PageLayout {
  index: number;
  /** Distance from the top of the scroll content (CSS px, at current zoom). */
  top: number;
  /** Distance from the left edge of the scroll content (centers the page). */
  left: number;
  /** Displayed width at the current zoom (CSS px). */
  width: number;
  /** Displayed height at the current zoom (CSS px). */
  height: number;
}

/** The full laid-out document: page boxes plus the total scrollable extent. */
export interface ViewerLayout {
  pages: PageLayout[];
  totalHeight: number;
  totalWidth: number;
}

/** Inclusive range of page indices to mount; { start: -1 } means "nothing visible yet". */
export interface VisibleRange {
  start: number;
  end: number;
}
