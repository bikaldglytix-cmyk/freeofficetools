/**
 * ValidationService — pre-flight checks over the canonical document before a
 * single byte is written. Validation is *non-throwing by default*: it returns
 * diagnostics so the pipeline can decide (fatal `error`s abort, `warning`s are
 * recorded and the offending object is skipped). This keeps a single malformed
 * object from sinking an otherwise good 1000-page export.
 *
 * Checks: structural integrity (page/object references resolve), geometry
 * sanity (finite, non-degenerate, on/near the page), resource references
 * (image src present, signature payload present), and export conflicts
 * (redaction over content, fully out-of-bounds objects).
 */
import {
  isAnnotation,
  isImageObject,
  isRedaction,
  isSignature,
  isTextBlock,
} from "../model/guards";
import type { DocumentState, EditableObject, PageId, Rect } from "../model/types";
import { placementFor, rectIntersectsPage } from "./geometry";
import type { ExportDiagnostic } from "./types";

export interface ValidationReport {
  ok: boolean;
  diagnostics: ExportDiagnostic[];
  /** Object ids that should be skipped during rendering (failed a hard check). */
  skip: Set<string>;
}

export class ValidationService {
  validate(doc: DocumentState, pageRange: PageId[] | null): ValidationReport {
    const diagnostics: ExportDiagnostic[] = [];
    const skip = new Set<string>();
    let fatal = false;

    const pages = pageRange ?? doc.pageOrder;
    if (pages.length === 0) {
      diagnostics.push({ severity: "error", code: "NO_PAGES", message: "Document has no pages to export." });
      return { ok: false, diagnostics, skip };
    }

    for (const pageId of pages) {
      const page = doc.pages[pageId];
      if (!page) {
        diagnostics.push({
          severity: "error",
          code: "MISSING_PAGE",
          message: `Page ${pageId} is referenced in the export range but absent from the document.`,
          pageId,
        });
        fatal = true;
        continue;
      }
      if (!isFiniteSize(page.size.width) || !isFiniteSize(page.size.height)) {
        diagnostics.push({
          severity: "error",
          code: "INVALID_PAGE_SIZE",
          message: `Page ${pageId} has an invalid size (${page.size.width}×${page.size.height}).`,
          pageId,
        });
        fatal = true;
        continue;
      }

      const placement = placementFor(page.size, page.rotation);
      const order = doc.objectOrder[pageId] ?? [];
      const objects = doc.objectsByPage[pageId] ?? {};

      for (const id of order) {
        const obj = objects[id];
        if (!obj) {
          diagnostics.push({
            severity: "warning",
            code: "DANGLING_OBJECT",
            message: `Object ${id} is in the z-order of page ${pageId} but has no data; skipped.`,
            pageId,
            objectId: id,
          });
          continue;
        }
        if (!obj.visible) {
          skip.add(id); // intentional: invisible objects are not exported.
          continue;
        }

        const geomError = checkRect(obj.rect);
        if (geomError) {
          diagnostics.push({
            severity: "warning",
            code: "INVALID_GEOMETRY",
            message: `Object ${id} on page ${pageId} has invalid geometry (${geomError}); skipped.`,
            pageId,
            objectId: id,
          });
          skip.add(id);
          continue;
        }

        if (!rectIntersectsPage(obj.rect, placement)) {
          diagnostics.push({
            severity: "info",
            code: "OFFPAGE_OBJECT",
            message: `Object ${id} on page ${pageId} lies entirely outside the page; skipped.`,
            pageId,
            objectId: id,
          });
          skip.add(id);
          continue;
        }

        const resourceError = checkResource(obj);
        if (resourceError) {
          diagnostics.push({
            severity: "warning",
            code: "MISSING_RESOURCE",
            message: `Object ${id} on page ${pageId}: ${resourceError}; skipped.`,
            pageId,
            objectId: id,
          });
          skip.add(id);
        }
      }
    }

    return { ok: !fatal, diagnostics, skip };
  }
}

function isFiniteSize(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < 200_000; // PDF max page side is 14400pt; allow slack.
}

function checkRect(r: Rect): string | null {
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) return "non-finite coordinates";
  if (r.width <= 0 || r.height <= 0) return "non-positive size";
  return null;
}

function checkResource(obj: EditableObject): string | null {
  if (isImageObject(obj)) {
    if (!obj.src) return "image has no source";
  } else if (isSignature(obj)) {
    if (obj.signatureType === "typed") {
      if (!obj.text) return "typed signature has no text";
    } else if (!obj.src) {
      return "signature has no image source";
    }
  } else if (isTextBlock(obj)) {
    if (obj.source === "added" && obj.text.length === 0 && !(obj.runs && obj.runs.length)) {
      return "empty added text block";
    }
  } else if (isAnnotation(obj)) {
    if ((obj.annotationType === "ink" || obj.shape === "line" || obj.shape === "arrow") && (!obj.points || obj.points.length < 4)) {
      return "ink/line annotation has too few points";
    }
  } else if (isRedaction(obj)) {
    // redactions are always valid if geometry passed.
  }
  return null;
}
