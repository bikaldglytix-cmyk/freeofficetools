/**
 * PageOperations — materializes the output page set from the canonical model.
 *
 * All page-level edits already live in the model, so export simply honors them:
 *   - reorder / delete  → we walk `pageOrder` (or the caller's pageRange).
 *   - duplicate         → two model pages share one `sourcePageIndex`; each is
 *                         copied independently from the source.
 *   - insert (blank)    → `sourcePageIndex === null` → a blank page sized to the
 *                         model is created.
 *   - rotate            → the output page's /Rotate is set from `page.rotation`.
 *   - crop              → optional `page.metadata.cropBox` (a visual-space Rect)
 *                         is applied as the crop box.
 *   - merge / import    → imported pages appear in the model as inserted pages
 *                         (sourcePageIndex null) carrying their content as image
 *                         objects; those render through the normal pipeline. (A
 *                         second source PDF is not threaded through the model, so
 *                         true vector-preserving cross-document merge happens in
 *                         the state engine at import time, not here.)
 *
 * Each returned target carries the live pdf-lib `PDFPage` plus its
 * {@link PagePlacement}; renderers draw onto it.
 */
import { degrees } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { DocumentState, PageId, PDFPageModel, Rect } from "../model/types";
import { placementFor, type PagePlacement } from "./geometry";
import { ExportError } from "./errors";
import type { PDFWriter } from "./pdf-writer";
import type { ExportDiagnostic } from "./types";

export interface RenderTarget {
  pageId: PageId;
  model: PDFPageModel;
  page: PDFPage;
  placement: PagePlacement;
}

export class PageOperations {
  async buildPages(
    doc: DocumentState,
    writer: PDFWriter,
    pageRange: PageId[] | null,
    diagnostics: ExportDiagnostic[],
  ): Promise<RenderTarget[]> {
    const order = pageRange ?? doc.pageOrder;
    const targets: RenderTarget[] = [];

    for (const pageId of order) {
      const model = doc.pages[pageId];
      if (!model) continue; // validation already flagged this.

      const placement = placementFor(model.size, model.rotation);
      let page: PDFPage;

      if (model.sourcePageIndex !== null && writer.hasSource()) {
        try {
          page = await writer.copySourcePage(model.sourcePageIndex);
          writer.doc.addPage(page);
        } catch (err) {
          // Recoverable: substitute a blank page so the rest of the doc exports.
          diagnostics.push({
            severity: "warning",
            code: "PAGE_COPY_FAILED",
            message: `Could not copy source page ${model.sourcePageIndex} for ${pageId}; inserted a blank page instead.`,
            pageId,
            detail: { error: (err as ExportError).message },
          });
          page = writer.doc.addPage([placement.mediaWidth, placement.mediaHeight]);
        }
      } else {
        if (model.sourcePageIndex !== null && !writer.hasSource()) {
          diagnostics.push({
            severity: "warning",
            code: "MISSING_SOURCE",
            message: `Page ${pageId} references original content but no source PDF was provided; rendering overlay objects on a blank page.`,
            pageId,
          });
        }
        page = writer.doc.addPage([placement.mediaWidth, placement.mediaHeight]);
      }

      // Apply rotation from the model (overrides any inherited /Rotate so editor
      // rotations win and stay consistent with `placement`).
      page.setRotation(degrees(placement.rotation));

      applyCrop(page, model, placement, diagnostics);

      targets.push({ pageId, model, page, placement });
    }

    if (targets.length === 0) {
      throw new ExportError("NO_PAGES", "No pages were produced for export.");
    }
    return targets;
  }
}

/** Apply an optional crop box stored as a visual-space Rect in page metadata. */
function applyCrop(page: PDFPage, model: PDFPageModel, placement: PagePlacement, diagnostics: ExportDiagnostic[]): void {
  const crop = model.metadata?.cropBox as Rect | undefined;
  if (!crop) return;
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.width <= 0 || crop.height <= 0) {
    diagnostics.push({
      severity: "warning",
      code: "INVALID_CROP",
      message: `Ignored an invalid crop box on page ${model.id}.`,
      pageId: model.id,
    });
    return;
  }
  // Crop is given in visual top-left coords; convert to unrotated mediabox space.
  // For axis-aligned page rotations the crop rect stays axis-aligned, so map its
  // top-left and bottom-right corners and normalize.
  const { mediaHeight: H } = placement;
  const x0 = crop.x;
  const y1 = H - crop.y; // top edge in pdf space
  const y0 = H - (crop.y + crop.height); // bottom edge
  page.setCropBox(x0, Math.min(y0, y1), crop.width, Math.abs(y1 - y0));
}
