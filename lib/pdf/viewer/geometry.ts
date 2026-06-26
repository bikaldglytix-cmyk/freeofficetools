/**
 * Pure geometry for the viewer: page stacking layout, scroll virtualization,
 * current-page detection and fit-to-* zoom. No pdf.js, no DOM — easy to reason
 * about and unit-test, and shared by every viewer hook/component.
 */
import type { PageSize, ViewerLayout, PageLayout, VisibleRange } from "./types";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
/** Zoom steps used by the toolbar +/- buttons. */
export const ZOOM_STEPS = [0.25, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6];

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Next/previous discrete zoom step relative to the current zoom. */
export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    const next = ZOOM_STEPS.find((z) => z > current + 1e-3);
    return clampZoom(next ?? MAX_ZOOM);
  }
  const prev = [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-3);
  return clampZoom(prev ?? MIN_ZOOM);
}

export interface LayoutOptions {
  zoom: number;
  /** Vertical gap between consecutive pages (CSS px). */
  gap: number;
  /** Width of the scroll viewport (CSS px), used to center pages horizontally. */
  containerWidth: number;
  /** Padding around the whole page stack (CSS px). */
  padding: number;
}

/**
 * Stack pages vertically, centered horizontally, returning absolute boxes plus
 * the total scrollable size. Pages may differ in size; offsets are cumulative.
 */
export function computeLayout(pageSizes: PageSize[], opts: LayoutOptions): ViewerLayout {
  const { zoom, gap, containerWidth, padding } = opts;
  const pages: PageLayout[] = [];
  let y = padding;
  let maxWidth = 0;

  for (let i = 0; i < pageSizes.length; i++) {
    const width = pageSizes[i].width * zoom;
    const height = pageSizes[i].height * zoom;
    maxWidth = Math.max(maxWidth, width);
    pages.push({ index: i, top: y, left: 0, width, height });
    y += height;
    if (i < pageSizes.length - 1) y += gap;
  }

  // Content is as wide as the widest page, but never narrower than the viewport
  // so single narrow pages still center instead of hugging the left edge.
  const contentWidth = Math.max(maxWidth, containerWidth - padding * 2);
  for (const p of pages) {
    p.left = padding + Math.max(0, (contentWidth - p.width) / 2);
  }

  return {
    pages,
    totalHeight: y + padding,
    totalWidth: contentWidth + padding * 2,
  };
}

/**
 * Indices of pages intersecting the viewport, expanded by `overscan` pages on
 * each side so scrolling reveals already-rendered pages. Pages array is sorted
 * by `top`, so we can early-exit once we pass the bottom edge.
 */
export function visiblePageRange(
  layout: ViewerLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan = 1,
): VisibleRange {
  const top = scrollTop;
  const bottom = scrollTop + viewportHeight;
  let start = -1;
  let end = -1;

  for (const p of layout.pages) {
    const pTop = p.top;
    const pBottom = p.top + p.height;
    if (pBottom < top) continue;
    if (pTop > bottom) break;
    if (start === -1) start = p.index;
    end = p.index;
  }

  if (start === -1) return { start: -1, end: -1 };
  return {
    start: Math.max(0, start - overscan),
    end: Math.min(layout.pages.length - 1, end + overscan),
  };
}

/** The page whose center is closest to ~40% down the viewport — the "current" page. */
export function currentPageAt(layout: ViewerLayout, scrollTop: number, viewportHeight: number): number {
  if (layout.pages.length === 0) return 0;
  const anchor = scrollTop + viewportHeight * 0.4;
  let best = 0;
  let bestDist = Infinity;
  for (const p of layout.pages) {
    const center = p.top + p.height / 2;
    const dist = Math.abs(center - anchor);
    if (dist < bestDist) {
      bestDist = dist;
      best = p.index;
    }
  }
  return best;
}

/** Zoom that fits a page to the container width, or to the full page (min of width/height fit). */
export function fitZoom(
  page: PageSize,
  mode: "width" | "page",
  containerWidth: number,
  containerHeight: number,
  padding: number,
): number {
  const availW = Math.max(1, containerWidth - padding * 2);
  const zW = availW / page.width;
  if (mode === "width") return clampZoom(zW);
  const availH = Math.max(1, containerHeight - padding * 2);
  const zH = availH / page.height;
  return clampZoom(Math.min(zW, zH));
}

/**
 * Capture a scroll anchor (which page, and how far into it) so zoom changes keep
 * the same content under the user's eye instead of jumping to the top.
 */
export function captureAnchor(layout: ViewerLayout, scrollTop: number, currentPage: number) {
  const p = layout.pages[currentPage];
  if (!p) return { page: 0, fraction: 0 };
  const fraction = p.height > 0 ? (scrollTop - p.top) / p.height : 0;
  return { page: currentPage, fraction };
}

/** Resolve a previously captured anchor back into a scrollTop for a new layout. */
export function resolveAnchor(layout: ViewerLayout, anchor: { page: number; fraction: number }): number {
  const p = layout.pages[anchor.page];
  if (!p) return 0;
  return Math.max(0, p.top + anchor.fraction * p.height);
}
