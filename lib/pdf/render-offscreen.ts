/**
 * Worker-side full-resolution PDF page rasterization via OffscreenCanvas.
 *
 * This module is imported *only* from a worker context (see the dynamic import
 * guarded by `typeof document === "undefined"` in `pdf-to-images.ts`). Keeping
 * it separate matters: it statically imports pdf.js's worker build and registers
 * it on `globalThis`, which we never want to happen on the main thread.
 *
 * pdf.js runs single-threaded inside this worker (the `globalThis.pdfjsWorker`
 * trick) so parsing *and* rasterization stay off the UI thread. The trade-off,
 * shared with the thumbnail worker, is that filter effects (blend modes, soft
 * masks, high-contrast) render as "none" — the DOM `<filter>` path they need
 * doesn't exist without a document. Typical text/vector/photo PDFs are
 * unaffected; only exotic design PDFs relying on blend modes differ. The
 * main-thread fallback in `pdf-to-images.ts` keeps full fidelity.
 */
import * as pdfjs from "pdfjs-dist";
// @ts-expect-error -- no .d.ts ships for the minified worker build
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import type { ProcessContext, ProcessResult, OutputFile } from "@/lib/process/types";
import type { PdfToImagesOptions } from "@/lib/pdf/pdf-to-images";
import { baseName } from "@/lib/files";

// Run pdf.js's worker logic inline instead of spawning a nested Worker (which
// would touch `window`). Same supported "bundled worker" path the thumbnail
// worker uses.
(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

interface CanvasAndContext {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

/** pdf.js's default factory calls `document.createElement`; supply a worker-safe one. */
class OffscreenCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    return { canvas, context };
  }
  reset(cc: CanvasAndContext, width: number, height: number): void {
    if (!cc.canvas) throw new Error("Canvas is not specified");
    cc.canvas.width = Math.max(1, width);
    cc.canvas.height = Math.max(1, height);
  }
  destroy(cc: CanvasAndContext): void {
    if (cc.canvas) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    }
    cc.canvas = null;
    cc.context = null;
  }
}

/** The default filter factory builds SVG `<filter>` elements, which need a document. */
class NoopFilterFactory {
  addFilter(): string {
    return "none";
  }
  addHCMFilter(): string {
    return "none";
  }
  addAlphaFilter(): string {
    return "none";
  }
  addLuminosityFilter(): string {
    return "none";
  }
  addHighlightHCMFilter(): string {
    return "none";
  }
  addSelectionHCMFilter(): string {
    return "none";
  }
  addSelectionFilter(): string {
    return "none";
  }
  createSelectionStyle(): null {
    return null;
  }
  destroy(): void {}
}

/** Render PDF pages to JPG images inside a worker, one output per page. */
export async function pdfToImagesOffscreen(
  files: File[],
  options: PdfToImagesOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas is unavailable in this worker.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    CanvasFactory: OffscreenCanvasFactory,
    FilterFactory: NoopFilterFactory,
    isOffscreenCanvasSupported: true,
    isImageDecoderSupported: "ImageDecoder" in globalThis,
    disableFontFace: true,
    useWorkerFetch: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const doc = await loadingTask.promise;
  const base = baseName(file.name);
  const outputs: OutputFile[] = [];

  // One reusable canvas across all pages — no per-page backing-store allocation.
  let canvas: OffscreenCanvas | null = null;

  try {
    const selected =
      options.pages && options.pages.length
        ? options.pages.filter((i) => i >= 0 && i < doc.numPages).map((i) => i + 1)
        : Array.from({ length: doc.numPages }, (_, i) => i + 1);

    if (!selected.length) throw new Error("No valid pages selected.");

    for (let i = 0; i < selected.length; i++) {
      const pageNo = selected[i];
      const page = await doc.getPage(pageNo);
      try {
        const viewport = page.getViewport({ scale: options.scale });
        const width = Math.max(1, Math.floor(viewport.width));
        const height = Math.max(1, Math.floor(viewport.height));
        if (!canvas) {
          canvas = new OffscreenCanvas(width, height);
        } else {
          canvas.width = width;
          canvas.height = height;
        }
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Couldn't create an OffscreenCanvas 2D context.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        } as unknown as Parameters<typeof page.render>[0]).promise;
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: options.quality });
        outputs.push({ name: `${base}-page-${pageNo}.jpg`, blob });
      } finally {
        page.cleanup();
      }
      ctx?.onProgress?.((i + 1) / selected.length);
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await loadingTask.destroy();
  }

  return { outputs, meta: { images: outputs.length } };
}
