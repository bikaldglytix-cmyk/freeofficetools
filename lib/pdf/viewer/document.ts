/**
 * Loads a PDF into a `ViewerDocument` for rendering with pdf.js.
 *
 * Note this is the *render* path (pdf.js), distinct from `lib/pdf/core.ts` which
 * loads with pdf-lib for structural edits/export. The editor needs both: pdf.js
 * to display and select, pdf-lib (Phase 5) to write the result.
 */
import { getPdfjs } from "@/lib/pdf/pdfjs";
import type { ViewerDocument, PageSize } from "./types";

export type PdfSource = File | ArrayBuffer | Uint8Array;

async function toBytes(source: PdfSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(await source.arrayBuffer());
}

/**
 * Open a document and measure every page up front. Up-front measurement keeps
 * the scroll layout exact even when page sizes vary; for very large documents
 * this trades a slightly longer open for correct, jump-free virtualization.
 */
export async function loadViewerDocument(source: PdfSource): Promise<ViewerDocument> {
  const pdfjs = await getPdfjs();
  const data = await toBytes(source);

  const loadingTask = pdfjs.getDocument({ data });
  const proxy = await loadingTask.promise;
  const numPages = proxy.numPages;

  const pageSizes: PageSize[] = new Array(numPages);
  for (let i = 0; i < numPages; i++) {
    const page = await proxy.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes[i] = {
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate,
    };
  }

  let destroyed = false;
  return {
    proxy,
    numPages,
    pageSizes,
    getPage: (index: number) => proxy.getPage(index + 1),
    destroy: async () => {
      if (destroyed) return;
      destroyed = true;
      await loadingTask.destroy();
    },
  };
}
