import { PDFDocument } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { getPdfjs, renderPageToCanvas, canvasToBlob } from "@/lib/pdf/pdfjs";
import { bytesToBlob, PDF_MIME } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface CompressOptions {
  /** Raster scale: lower = smaller file. */
  scale: number;
  /** JPEG quality 0–1. */
  quality: number;
}

/**
 * Compress by rasterizing each page and rebuilding the PDF with optimized
 * JPEG images. This shrinks scanned and image-heavy PDFs dramatically. If the
 * result isn't actually smaller, the original is returned untouched.
 */
export async function compressPdf(
  files: File[],
  options: CompressOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");

  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const originalSize = originalBytes.byteLength;

  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data: originalBytes.slice() });
  const doc = await loadingTask.promise;
  const out = await PDFDocument.create();

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const baseViewport = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(page, options.scale);
      const jpegBlob = await canvasToBlob(canvas, "image/jpeg", options.quality);
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const image = await out.embedJpg(jpegBytes);
      const newPage = out.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
      page.cleanup();
      ctx?.onProgress?.(n / doc.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }

  const newBytes = await out.save();
  const newSize = newBytes.byteLength;

  // Don't hand back a bigger file — keep the original if compression didn't help.
  if (newSize >= originalSize) {
    return {
      outputs: [{ name: `${baseName(file.name)}.pdf`, blob: bytesToBlob(originalBytes, PDF_MIME) }],
      meta: { originalSize, newSize: originalSize, alreadyOptimized: true },
    };
  }

  return {
    outputs: [{ name: `${baseName(file.name)}-compressed.pdf`, blob: bytesToBlob(newBytes, PDF_MIME) }],
    meta: { originalSize, newSize, savedPercent: Math.round((1 - newSize / originalSize) * 100) },
  };
}
