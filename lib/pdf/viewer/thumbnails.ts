/**
 * Lazy, cached thumbnail rendering for the sidebar.
 *
 * Unlike `lib/pdf/thumbnails.ts` (which eagerly renders every page for the
 * page-picker tools), the editor renders thumbnails on demand as they scroll
 * into view and caches the resulting object URLs per document, so revisiting a
 * page is instant and we never render hundreds of pages we won't see.
 *
 * When the browser supports it, pages are rasterized + JPEG-encoded in a Web
 * Worker (OffscreenCanvas) so fast scrolling never janks the UI thread. The
 * worker opens its own copy of the PDF bytes (`proxy.getData()`); if the worker
 * is unavailable or errors, rendering falls back to the in-thread path using the
 * already-open document — identical output, no off-main-thread benefit.
 */
import type { ViewerDocument } from "./types";
import { renderPageToCanvas, canvasToBlob } from "@/lib/pdf/pdfjs";
import {
  thumbnailWorkerSupported,
  openThumbnailRenderer,
  type ThumbnailRenderer,
} from "@/lib/pdf/thumbnail-worker-client";

export interface ThumbnailCache {
  /** Returns a JPEG object URL for the page, rendering + caching on first request. */
  get(pageIndex: number): Promise<string>;
  /** Drop cached entries and revoke their object URLs (e.g. on unmount). */
  clear(): void;
}

const QUALITY = 0.7;

export function createThumbnailCache(doc: ViewerDocument, targetWidth = 150): ThumbnailCache {
  const cache = new Map<number, string>();
  const inflight = new Map<number, Promise<string>>();

  // Lazily opened on first request and reused for the document's lifetime. Once
  // the worker proves unusable we stop trying it and stay on the in-thread path.
  let rendererPromise: Promise<ThumbnailRenderer> | null = null;
  let useWorker = thumbnailWorkerSupported();

  function getRenderer(): Promise<ThumbnailRenderer> {
    if (!rendererPromise) {
      rendererPromise = (async () => {
        // Copy the bytes before transfer so the main-thread document keeps its
        // own buffer intact (the worker detaches whatever it's handed).
        const bytes = await doc.proxy.getData();
        const buffer = bytes.slice().buffer;
        return openThumbnailRenderer(buffer);
      })();
    }
    return rendererPromise;
  }

  function disposeRenderer(): void {
    const p = rendererPromise;
    rendererPromise = null;
    p?.then((r) => r.dispose()).catch(() => {});
  }

  async function renderInWorker(pageIndex: number): Promise<string> {
    const renderer = await getRenderer();
    const { blob } = await renderer.renderPage(pageIndex, { targetWidth, quality: QUALITY });
    return URL.createObjectURL(blob);
  }

  async function renderOnMainThread(pageIndex: number): Promise<string> {
    const page = await doc.getPage(pageIndex);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const canvas = await renderPageToCanvas(page, scale);
    // Object URL over a base64 data URL: async encode (no main-thread base64
    // stall) and a tiny string instead of a multi-KB one retained per page.
    const blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
    const url = URL.createObjectURL(blob);
    // Free the backing store promptly; the object URL is all we keep.
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    return url;
  }

  async function render(pageIndex: number): Promise<string> {
    if (useWorker) {
      try {
        const url = await renderInWorker(pageIndex);
        cache.set(pageIndex, url);
        return url;
      } catch {
        // Drop to the in-thread path for this and every later page, and release
        // the broken worker so we don't keep a dead one around.
        useWorker = false;
        disposeRenderer();
      }
    }
    const url = await renderOnMainThread(pageIndex);
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
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
      inflight.clear();
      disposeRenderer();
    },
  };
}
