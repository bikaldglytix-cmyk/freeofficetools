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

function canvasPixelBudget(): number {
  if (typeof navigator === "undefined") return 12_000_000;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  const lowCore = (nav.hardwareConcurrency ?? 8) <= 4;
  return lowMemory || lowCore ? 5_000_000 : 12_000_000;
}

function effectiveDpr(cssWidth: number, cssHeight: number, requested: number): number {
  if (typeof window === "undefined") return 1;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const touchDevice = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const lowPower = touchDevice || (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
  const capped = Math.min(requested || 1, lowPower ? 1.25 : 2);
  const pixelsAtCap = cssWidth * cssHeight * capped * capped;
  if (pixelsAtCap <= canvasPixelBudget()) return capped;
  return Math.max(1, Math.sqrt(canvasPixelBudget() / Math.max(1, cssWidth * cssHeight)));
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
  const cssViewport = page.getViewport({ scale: zoom });
  const renderDpr = effectiveDpr(cssViewport.width, cssViewport.height, dpr);
  const deviceViewport = page.getViewport({ scale: zoom * renderDpr });

  canvas.width = Math.max(1, Math.floor(deviceViewport.width));
  canvas.height = Math.max(1, Math.floor(deviceViewport.height));
  canvas.style.width = `${Math.floor(cssViewport.width)}px`;
  canvas.style.height = `${Math.floor(cssViewport.height)}px`;

  // NOTE: no `desynchronized` hint — it breaks getImageData readback on
  // Chrome (returns the initial white fill), and the editor samples this
  // canvas to colour-match its text-edit masks. For a static page raster the
  // latency win is imperceptible anyway.
  const context = canvas.getContext("2d", { alpha: false });
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
