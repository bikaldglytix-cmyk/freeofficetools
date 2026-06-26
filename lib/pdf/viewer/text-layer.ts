/**
 * Builds pdf.js's selectable text layer over a rendered page.
 *
 * pdf.js v6 exposes a `TextLayer` *class* (the old `renderTextLayer()` function
 * is gone). It appends transparent, absolutely-positioned spans whose font-size
 * is driven by the CSS custom property `--total-scale-factor`; we set that to
 * the current zoom so the text boxes line up exactly with the canvas glyphs.
 * The matching CSS lives in `app/globals.css` under `.pdf-editor-viewer`.
 */
import type { PDFPageProxy } from "pdfjs-dist";
import { getPdfjs } from "@/lib/pdf/pdfjs";

export interface TextLayerHandle {
  cancel(): void;
}

export async function renderTextLayer(
  page: PDFPageProxy,
  container: HTMLElement,
  zoom: number,
): Promise<TextLayerHandle> {
  const pdfjs = await getPdfjs();
  if (typeof pdfjs.TextLayer !== "function") {
    throw new Error("This pdf.js build does not expose TextLayer.");
  }

  const viewport = page.getViewport({ scale: zoom });
  container.replaceChildren();
  container.style.width = `${Math.floor(viewport.width)}px`;
  container.style.height = `${Math.floor(viewport.height)}px`;
  // pdf.js computes per-span font-size as `--total-scale-factor * --font-height`.
  container.style.setProperty("--total-scale-factor", String(zoom));
  container.style.setProperty("--scale-factor", String(zoom));

  const textContent = await page.getTextContent();
  const textLayer = new pdfjs.TextLayer({
    textContentSource: textContent,
    container,
    viewport,
  });
  await textLayer.render();

  return { cancel: () => textLayer.cancel() };
}
