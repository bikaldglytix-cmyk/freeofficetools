import { getPdfjs, renderPageToCanvas } from "@/lib/pdf/pdfjs";

export interface PageThumb {
  index: number; // 0-based
  url: string; // data URL (JPEG)
  width: number;
  height: number;
}

export interface ThumbnailOptions {
  targetWidth?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Render small JPEG thumbnails for every page, used by the visual page-picker
 * tools (delete, extract, reorder, rotate). Runs entirely in the browser.
 */
export async function renderThumbnails(file: File, opts: ThumbnailOptions = {}): Promise<PageThumb[]> {
  const targetWidth = opts.targetWidth ?? 170;
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const thumbs: PageThumb[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const canvas = await renderPageToCanvas(page, scale);
      thumbs.push({
        index: n - 1,
        url: canvas.toDataURL("image/jpeg", 0.72),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
      opts.onProgress?.(n / doc.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }

  return thumbs;
}
