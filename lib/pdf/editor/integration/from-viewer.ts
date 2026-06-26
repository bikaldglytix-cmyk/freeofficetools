/**
 * Adapter: build a canonical {@link DocumentState} from the Phase 1
 * {@link ViewerDocument}.
 *
 * This is the seam between the *render* world (pdf.js, screen pixels, lazy page
 * proxies) and the *edit* world (normalized model, PDF points). The viewer keeps
 * rendering from its own `ViewerDocument`; the store holds the editable overlay.
 * Both share page identity by index, so a rendered page and its editable objects
 * line up.
 *
 * Coordinate note: pdf.js measures pages at `scale = 1`, where 1 CSS px == 1 PDF
 * point, and its scale-1 viewport already bakes in the page's intrinsic
 * rotation. We therefore copy those dimensions straight into the model's points
 * space and record the rotation for the export engine to reconcile in Phase 5.
 */
import { createDocument, createPage } from "../model/factory";
import type { DocumentState, PDFPageModel } from "../model/types";
import type { ViewerDocument } from "@/lib/pdf/viewer/types";

export interface FromViewerOptions {
  title?: string;
  fileName?: string;
  pdfFingerprint?: string;
}

/** Map a loaded viewer document to an empty (no-edits-yet) editable document. */
export function buildDocumentFromViewer(
  viewer: ViewerDocument,
  options: FromViewerOptions = {},
): DocumentState {
  const pages: PDFPageModel[] = viewer.pageSizes.map((size, index) =>
    createPage({
      size: { width: size.width, height: size.height },
      rotation: size.rotation,
      sourcePageIndex: index,
    }),
  );

  return createDocument({
    title: options.title ?? options.fileName ?? "Untitled",
    fileName: options.fileName ?? "document.pdf",
    pdfFingerprint: options.pdfFingerprint,
    pages,
  });
}

/**
 * Resolve a 0-based source page index to its current page id in the store
 * (page ids are stable; their order/index can change after edits).
 */
export function pageIdForSourceIndex(
  doc: DocumentState,
  sourcePageIndex: number,
): string | undefined {
  for (const id of doc.pageOrder) {
    if (doc.pages[id]?.sourcePageIndex === sourcePageIndex) return id;
  }
  return undefined;
}
