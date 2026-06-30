/**
 * Web Worker that renders PDF page thumbnails off the main thread using
 * OffscreenCanvas.
 *
 * pdf.js runs *single-threaded inside this worker*: registering its worker
 * message handler on `globalThis.pdfjsWorker` makes pdf.js use it directly
 * instead of spawning a nested Worker (which would also touch `window`, which
 * doesn't exist here). Both parsing and rasterization therefore happen on this
 * thread, so the UI thread never rasterizes a page or encodes a JPEG — scrolling
 * and interaction stay smooth even for large documents.
 *
 * Spawn it via `thumbnail-worker-client.ts`; never import this file directly.
 *
 * Protocol (every request carries a client-assigned numeric `id`):
 *   → { type: "open", id, source }                 transfer the PDF ArrayBuffer
 *   ← { type: "opened", id, numPages }
 *   → { type: "renderPage", id, pageIndex, targetWidth, quality }
 *   ← { type: "page", id, index, blob, width, height }
 *   → { type: "renderAll", id, targetWidth, quality }
 *   ← { type: "page", id, index, blob, width, height }   (one per page, in order)
 *   ← { type: "allDone", id, count }
 *   ← { type: "error", id, message }
 */
import * as pdfjs from "pdfjs-dist";
// The minified worker build has no type declarations (it's a bundle artifact);
// we only need its `WorkerMessageHandler` export to register the fake worker.
// @ts-expect-error -- no .d.ts ships for the worker build
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Registering the handler on the global is pdf.js's supported "bundled worker"
// path: `PDFWorker` finds it and runs the worker logic inline instead of
// creating (and probing, via `window`) a real nested Worker.
(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

// `lib` is "dom" only, so describe just the worker globals we touch and cast.
interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}
const scope = self as unknown as WorkerScope;

/** A canvas plus its 2D context, the shape pdf.js's factories hand back. */
interface CanvasAndContext {
  canvas: OffscreenCanvas | null;
  context: OffscreenCanvasRenderingContext2D | null;
}

/**
 * pdf.js's default `DOMCanvasFactory` calls `document.createElement`, which
 * doesn't exist in a worker. pdf.js uses these scratch canvases internally for
 * patterns, soft masks and image smoothing, so a working factory is required.
 */
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

/**
 * The default `DOMFilterFactory` builds SVG `<filter>` elements (blend modes,
 * soft masks, high-contrast mode), which need a document. Thumbnails are tiny
 * previews that don't need pixel-perfect blend fidelity, so returning "none"
 * everywhere keeps filter-heavy PDFs from throwing here.
 */
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

let doc: PDFDocumentProxy | null = null;
// One reusable canvas for the page being rendered — no per-page allocation.
let canvas: OffscreenCanvas | null = null;

async function open(source: ArrayBuffer): Promise<number> {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas is unavailable in this worker.");
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(source),
    // Worker-safe factories (see above): no DOM is available here.
    CanvasFactory: OffscreenCanvasFactory,
    FilterFactory: NoopFilterFactory,
    isOffscreenCanvasSupported: true,
    isImageDecoderSupported: "ImageDecoder" in globalThis,
    // Render glyphs as vector paths instead of injecting @font-face rules
    // (which need a document); this is the standard off-DOM rendering mode.
    disableFontFace: true,
    // No cMap/standard-font fetching — avoids pdf.js touching `document.baseURI`.
    useWorkerFetch: false,
    // Keep the worker console quiet; the client falls back on real errors.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  doc = await loadingTask.promise;
  return doc.numPages;
}

interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

async function renderPage(pageIndex: number, targetWidth: number, quality: number): Promise<RenderedPage> {
  if (!doc) throw new Error("Document not open.");
  const page = await doc.getPage(pageIndex + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
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
    // White background so transparent PDFs don't flatten to black in JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      // pdf.js types describe an HTMLCanvasElement; OffscreenCanvas works at
      // runtime and is the whole point of rendering in a worker.
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return { blob, width, height };
  } finally {
    page.cleanup();
  }
}

type InMessage =
  | { type: "open"; id: number; source: ArrayBuffer }
  | { type: "renderPage"; id: number; pageIndex: number; targetWidth: number; quality: number }
  | { type: "renderAll"; id: number; targetWidth: number; quality: number };

scope.addEventListener("message", (ev: MessageEvent) => {
  void handle(ev.data as InMessage);
});

async function handle(msg: InMessage): Promise<void> {
  try {
    switch (msg.type) {
      case "open": {
        const numPages = await open(msg.source);
        scope.postMessage({ type: "opened", id: msg.id, numPages });
        break;
      }
      case "renderPage": {
        const { blob, width, height } = await renderPage(msg.pageIndex, msg.targetWidth, msg.quality);
        scope.postMessage({ type: "page", id: msg.id, index: msg.pageIndex, blob, width, height });
        break;
      }
      case "renderAll": {
        if (!doc) throw new Error("Document not open.");
        const count = doc.numPages;
        for (let i = 0; i < count; i++) {
          const { blob, width, height } = await renderPage(i, msg.targetWidth, msg.quality);
          scope.postMessage({ type: "page", id: msg.id, index: i, blob, width, height });
        }
        scope.postMessage({ type: "allDone", id: msg.id, count });
        break;
      }
    }
  } catch (err) {
    scope.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
