/**
 * Live true-removal rendering for the PDF editor.
 *
 * The editing view used to hide edited original text by painting white boxes
 * over the page canvas — which leaks "debris" (descender tails, antialiased
 * halos, anything on a non-white background). This module instead produces a
 * render source where the edited glyphs are GENUINELY GONE: it copies the one
 * page into a throwaway pdf-lib document, deletes the text-show operators
 * inside the edited regions (same engine the export pipeline uses), and opens
 * the result with pdf.js so the viewer can paint a raster that simply never
 * contained the old text. Backgrounds, images and gradients under the edit
 * survive untouched — the Acrobat behaviour.
 *
 * Cost model (browser-only, no servers):
 *  - pdf-lib parse of the source file happens ONCE per file, lazily on the
 *    first edit, and is cached in a WeakMap so closing the file releases it.
 *  - Each edit re-copies only the one page (tens of ms, debounced upstream).
 *  - All the little single-page pdf.js documents share ONE worker, created on
 *    first use, so there is no per-edit worker churn.
 *
 * Everything is best-effort: any failure returns null and the caller keeps the
 * mask fallback, so this can never make the view worse.
 */
import type { PDFPageProxy } from "pdfjs-dist";
import type { PDFDocument } from "pdf-lib";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { getPdfjs } from "@/lib/pdf/pdfjs";
import { regionFromVisualRect, removeTextInRegions } from "@/lib/pdf/editor/export/content-redactor";

export interface RedactedPage {
  /** Single-page pdf.js proxy with the edited glyphs removed; render this
   *  instead of the original page. */
  proxy: PDFPageProxy;
  /** Keys (see {@link rectKey}) of the input rects whose glyphs were verifiably
   *  removed — the masks for these can be dropped. Unmatched rects (e.g. text
   *  inside a form XObject) still need their mask. */
  cleanRectKeys: ReadonlySet<string>;
  /** Release the underlying pdf.js document. Idempotent. */
  destroy(): void;
}

/** Stable identity for a mask/removal rect, shared by the page renderer and the
 *  text layer so "this rect is clean now" survives independent recomputation. */
export function rectKey(r: Rect): string {
  return `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
}

/** One deterministic key for a whole region set, used to skip redundant builds. */
export function regionSetKey(rects: readonly Rect[]): string {
  return rects.map(rectKey).sort().join("|");
}

// The parsed source document is the expensive part (full-file parse); cache it
// per File so every page/edit reuses it. WeakMap → released with the file.
const sourceDocs = new WeakMap<File, Promise<PDFDocument | null>>();

function loadSourceDoc(file: File): Promise<PDFDocument | null> {
  let cached = sourceDocs.get(file);
  if (!cached) {
    cached = (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        return await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      } catch {
        return null;
      }
    })();
    sourceDocs.set(file, cached);
  }
  return cached;
}

/** Pre-parse the source with pdf-lib so the first edit's redacted render is
 *  instant instead of paying the full-file parse. Safe to call repeatedly. */
export function warmRedaction(file: File): void {
  void loadSourceDoc(file);
}

// One shared pdf.js worker for all single-page redacted documents. Passing an
// externally-owned worker to getDocument means task.destroy() frees the
// document but keeps the worker alive for the next edit.
type PdfjsModule = Awaited<ReturnType<typeof getPdfjs>>;
let sharedWorker: InstanceType<PdfjsModule["PDFWorker"]> | null = null;

/**
 * Build a render-ready copy of one page with every glyph inside `rects`
 * (visual space, y-down, scale 1) deleted from the content stream.
 *
 * Returns null — caller keeps masks — when the source can't be parsed, the
 * page is rotated (region mapping would need the rotation), or nothing was
 * actually removable.
 */
export async function buildRedactedPage(params: {
  file: File;
  pageIndex: number;
  rects: readonly Rect[];
  pageHeightPt: number;
  rotation: number;
}): Promise<RedactedPage | null> {
  const { file, pageIndex, rects, pageHeightPt, rotation } = params;
  if (rects.length === 0 || rotation !== 0) return null;
  try {
    const src = await loadSourceDoc(file);
    if (!src || pageIndex < 0 || pageIndex >= src.getPageCount()) return null;

    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.create();
    const [copied] = await out.copyPages(src, [pageIndex]);
    const regions = rects.map((r) => regionFromVisualRect(r, pageHeightPt));
    const result = removeTextInRegions(copied, regions);
    if (!result.ok || result.removed === 0) return null;
    out.addPage(copied);
    const bytes = await out.save();

    const pdfjs = await getPdfjs();
    if (!sharedWorker) sharedWorker = new pdfjs.PDFWorker();
    const task = pdfjs.getDocument({ data: bytes, worker: sharedWorker });
    const doc = await task.promise;
    const proxy = await doc.getPage(1);

    const cleanRectKeys = new Set<string>();
    rects.forEach((r, i) => {
      if (result.matched?.[i]) cleanRectKeys.add(rectKey(r));
    });

    let destroyed = false;
    return {
      proxy,
      cleanRectKeys,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        void task.destroy();
      },
    };
  } catch {
    return null;
  }
}
