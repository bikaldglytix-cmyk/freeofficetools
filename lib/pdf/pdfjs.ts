/**
 * Lazily loads pdf.js and configures its worker exactly once.
 * Only import this from client-side code paths that need to *render* pages
 * (PDF to JPG, compression, thumbnails). pdf-lib handles structural edits
 * without pdf.js, keeping most tools lighter.
 */
import type * as PdfjsModule from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";

type Pdfjs = typeof PdfjsModule;

let pdfjsPromise: Promise<Pdfjs> | null = null;

export function getPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Bundler-friendly worker resolution (works with Turbopack and webpack).
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/** Render a single PDF page to a canvas at the given scale and return it. */
export async function renderPageToCanvas(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't create a drawing canvas.");
  // White background so transparent PDFs don't flatten to black in JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

/** Encode a canvas to a Blob (JPEG by default). */
export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image."))),
      type,
      quality,
    );
  });
}
