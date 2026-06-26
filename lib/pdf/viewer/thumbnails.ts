/**
 * Lazy, cached thumbnail rendering for the sidebar.
 *
 * Unlike `lib/pdf/thumbnails.ts` (which eagerly renders every page for the
 * page-picker tools), the editor renders thumbnails on demand as they scroll
 * into view and caches the resulting data URLs per document, so revisiting a
 * page is instant and we never render hundreds of pages we won't see.
 */
import type { ViewerDocument } from "./types";
import { renderPageToCanvas } from "@/lib/pdf/pdfjs";

export interface ThumbnailCache {
  /** Returns a JPEG data URL for the page, rendering + caching on first request. */
  get(pageIndex: number): Promise<string>;
  /** Drop cached entries (e.g. on unmount). */
  clear(): void;
}

export function createThumbnailCache(doc: ViewerDocument, targetWidth = 150): ThumbnailCache {
  const cache = new Map<number, string>();
  const inflight = new Map<number, Promise<string>>();

  async function render(pageIndex: number): Promise<string> {
    const page = await doc.getPage(pageIndex);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const canvas = await renderPageToCanvas(page, scale);
    const url = canvas.toDataURL("image/jpeg", 0.7);
    // Free the backing store promptly; the data URL is all we keep.
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    cache.set(pageIndex, url);
    return url;
  }

  return {
    get(pageIndex: number) {
      const cached = cache.get(pageIndex);
      if (cached) return Promise.resolve(cached);
      const existing = inflight.get(pageIndex);
      if (existing) return existing;
      const promise = render(pageIndex).finally(() => inflight.delete(pageIndex));
      inflight.set(pageIndex, promise);
      return promise;
    },
    clear() {
      cache.clear();
      inflight.clear();
    },
  };
}
