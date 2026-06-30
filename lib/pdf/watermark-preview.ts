import { getPdfjs, renderPageToCanvas, canvasToBlob } from "@/lib/pdf/pdfjs";

export interface FirstPagePreview {
  /** Object URL of a JPEG render of page 1 — caller must revokeObjectURL it. */
  url: string;
  /** Page 1 size in PDF points; used to scale the watermark overlay to match output. */
  pageWidth: number;
  pageHeight: number;
  /** Total pages in the document, so the preview can say "applied to all N pages". */
  numPages: number;
}

/**
 * Render page 1 of a PDF to a JPEG object URL for the watermark live preview.
 *
 * Only the first page is rendered (the watermark is applied identically to every
 * page), and only once per file — the watermark itself is drawn as a cheap
 * canvas overlay on top, so dragging the sliders never re-renders the PDF.
 */
export async function renderFirstPagePreview(file: File, maxPixelWidth = 800): Promise<FirstPagePreview> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Render at ~maxPixelWidth so it stays crisp on hi-DPR screens; cap the
    // scale so a tiny page isn't blown up to a huge canvas.
    const scale = Math.min(maxPixelWidth / base.width, 4);
    const canvas = await renderPageToCanvas(page, scale);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    return {
      url: URL.createObjectURL(blob),
      pageWidth: base.width,
      pageHeight: base.height,
      numPages: doc.numPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}
