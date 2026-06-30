import type { ProcessContext, ProcessResult, OutputFile } from "@/lib/process/types";
import { getPdfjs, renderPageToCanvas, canvasToBlob } from "@/lib/pdf/pdfjs";
import { baseName } from "@/lib/files";

export interface PdfToImagesOptions {
  /** Render scale. ~1.5 = screen, ~2.5 = print quality. */
  scale: number;
  /** JPEG quality 0–1. */
  quality: number;
  /** 0-based page indices to export. Omit/empty = all pages. */
  pages?: number[];
}

/** Render PDF pages to JPG images (one output per page). */
export async function pdfToImages(
  files: File[],
  options: PdfToImagesOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");

  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const base = baseName(file.name);
  const outputs: OutputFile[] = [];

  try {
    const selected =
      options.pages && options.pages.length
        ? options.pages.filter((i) => i >= 0 && i < doc.numPages).map((i) => i + 1)
        : Array.from({ length: doc.numPages }, (_, i) => i + 1);

    if (!selected.length) throw new Error("No valid pages selected.");

    // One reusable canvas across all pages: encoding to a Blob snapshots the
    // pixels before the next page overwrites the canvas, so we avoid allocating
    // (and GC-ing) a full-page backing store per output — meaningful on a large
    // PDF rasterized at print scale on a low-memory device.
    const canvas = document.createElement("canvas");
    for (let i = 0; i < selected.length; i++) {
      const pageNo = selected[i];
      const page = await doc.getPage(pageNo);
      await renderPageToCanvas(page, options.scale, canvas);
      const blob = await canvasToBlob(canvas, "image/jpeg", options.quality);
      outputs.push({ name: `${base}-page-${pageNo}.jpg`, blob });
      page.cleanup();
      ctx?.onProgress?.((i + 1) / selected.length);
    }
    canvas.width = 0;
    canvas.height = 0;
  } finally {
    await loadingTask.destroy();
  }

  return { outputs, meta: { images: outputs.length } };
}
