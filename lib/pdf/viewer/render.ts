/**
 * Render a single PDF page into a caller-supplied <canvas>, DPR-aware and
 * cancelable. The canvas backing store is rendered at zoom × devicePixelRatio
 * for crispness, then CSS-downscaled to the layout size so it overlays the text
 * layer 1:1.
 */
import type { PDFPageProxy, RenderTask } from "pdfjs-dist";

export interface PageRenderHandle {
  /** Cancel an in-flight render (cheap, idempotent). */
  cancel(): void;
  /** Resolves when rendering finishes; swallows the expected cancel exception. */
  promise: Promise<void>;
}

function devicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return window.devicePixelRatio || 1;
}

function isCancel(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "RenderingCancelledException"
  );
}

export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  zoom: number,
  dpr = devicePixelRatio(),
): PageRenderHandle {
  // Backing store at full device resolution; CSS box at layout (zoom) size.
  const deviceViewport = page.getViewport({ scale: zoom * dpr });
  const cssViewport = page.getViewport({ scale: zoom });

  canvas.width = Math.max(1, Math.floor(deviceViewport.width));
  canvas.height = Math.max(1, Math.floor(deviceViewport.height));
  canvas.style.width = `${Math.floor(cssViewport.width)}px`;
  canvas.style.height = `${Math.floor(cssViewport.height)}px`;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't create a drawing canvas.");

  // White base so transparent PDFs don't render on the page's dark chrome.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const task: RenderTask = page.render({
    canvas,
    canvasContext: context,
    viewport: deviceViewport,
  });

  return {
    cancel: () => task.cancel(),
    promise: task.promise.then(
      () => undefined,
      (err: unknown) => {
        if (isCancel(err)) return;
        throw err;
      },
    ),
  };
}
