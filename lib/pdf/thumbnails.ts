import { getPdfjs, renderPageToCanvas, canvasToBlob } from "@/lib/pdf/pdfjs";
import { thumbnailWorkerSupported, openThumbnailRenderer } from "@/lib/pdf/thumbnail-worker-client";

export interface PageThumb {
  index: number; // 0-based
  url: string; // object URL (JPEG Blob) — caller must revokeObjectURL when done
  width: number;
  height: number;
}

export interface ThumbnailOptions {
  targetWidth?: number;
  onProgress?: (fraction: number) => void;
}

const QUALITY = 0.72;

/**
 * Render small JPEG thumbnails for every page, used by the visual page-picker
 * tools (delete, extract, reorder, rotate). Runs entirely in the browser.
 *
 * Rasterization + JPEG encoding happen in a Web Worker (OffscreenCanvas) when
 * the browser supports it, so a many-page document never freezes the UI thread.
 * Older browsers — and any runtime failure inside the worker — fall back to the
 * in-thread path below, which is byte-for-byte equivalent.
 */
export async function renderThumbnails(file: File, opts: ThumbnailOptions = {}): Promise<PageThumb[]> {
  const targetWidth = opts.targetWidth ?? 170;
  if (thumbnailWorkerSupported()) {
    try {
      return await renderInWorker(file, targetWidth, opts.onProgress);
    } catch {
      // Worker spawn/render failed (unsupported runtime, exotic PDF, …) — the
      // in-thread path is the proven fallback. The File is re-readable, so the
      // already-consumed ArrayBuffer above doesn't affect us.
    }
  }
  return renderOnMainThread(file, targetWidth, opts.onProgress);
}

async function renderInWorker(
  file: File,
  targetWidth: number,
  onProgress: ThumbnailOptions["onProgress"],
): Promise<PageThumb[]> {
  const source = await file.arrayBuffer();
  const renderer = await openThumbnailRenderer(source);
  const thumbs: PageThumb[] = [];
  try {
    const total = renderer.numPages;
    await renderer.renderAll({
      targetWidth,
      quality: QUALITY,
      onPage: ({ index, blob, width, height }) => {
        // Mint the object URL on the main thread, where it's revoked too.
        thumbs.push({ index, url: URL.createObjectURL(blob), width, height });
        onProgress?.(thumbs.length / total);
      },
    });
  } catch (err) {
    for (const t of thumbs) URL.revokeObjectURL(t.url);
    throw err;
  } finally {
    renderer.dispose();
  }
  // Pages stream in order, but keep the index contract explicit for callers.
  thumbs.sort((a, b) => a.index - b.index);
  return thumbs;
}

async function renderOnMainThread(
  file: File,
  targetWidth: number,
  onProgress: ThumbnailOptions["onProgress"],
): Promise<PageThumb[]> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const thumbs: PageThumb[] = [];
  // One reusable canvas for the whole batch — no per-page allocation churn.
  const canvas = document.createElement("canvas");

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      await renderPageToCanvas(page, scale, canvas);
      // Encode via async toBlob (not synchronous toDataURL): keeps the base64
      // encode off the main thread, and an object URL is a tiny string vs. a
      // multi-KB base64 data URL held in React state + the DOM. For an N-page
      // document this turns tens of MB of strings into a handful of blobs.
      const blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
      thumbs.push({
        index: n - 1,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
      onProgress?.(n / doc.numPages);
    }
  } catch (err) {
    // Don't leak the URLs we already created if a later page fails.
    for (const t of thumbs) URL.revokeObjectURL(t.url);
    throw err;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await loadingTask.destroy();
  }

  return thumbs;
}
