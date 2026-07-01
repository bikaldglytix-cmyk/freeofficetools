/**
 * The catalogue of PDF operations that can run off the main thread.
 *
 * Every entry lazily imports the same pure `(files, options, ctx) => ProcessResult`
 * engine the runners used to call directly. Lazy loading matters: the worker
 * pulls in only the code for the op actually requested (a merge never loads
 * pdf.js; a pdf-to-jpg never loads the compressor), so each op keeps its own
 * dependency chunk.
 *
 * Both `pdf-worker.ts` (worker thread) and `pdf-worker-client.ts` (main-thread
 * fallback) dispatch through here, so the two paths are guaranteed identical.
 */
import type { ProcessContext, ProcessResult } from "@/lib/process/types";

export type PdfOp =
  | "merge"
  | "split"
  | "delete-pages"
  | "extract-pages"
  | "reorder"
  | "rotate"
  | "rotate-pages"
  | "watermark"
  | "images-to-pdf"
  | "pdf-to-images"
  | "compress";

/** The shared engine signature. Options are op-specific, validated by each engine. */
type OpFn = (files: File[], options: unknown, ctx?: ProcessContext) => Promise<ProcessResult>;

// Cast each engine to the erased OpFn shape at the import boundary. The concrete
// option type is enforced by the caller (the runner) and re-checked inside the
// engine, so erasing it here costs no real safety.
const loaders: Record<PdfOp, () => Promise<OpFn>> = {
  merge: () => import("@/lib/pdf/merge").then((m) => m.mergePdfs as unknown as OpFn),
  split: () => import("@/lib/pdf/split").then((m) => m.splitPdf as unknown as OpFn),
  "delete-pages": () => import("@/lib/pdf/delete-pages").then((m) => m.deletePdfPages as unknown as OpFn),
  "extract-pages": () => import("@/lib/pdf/extract-pages").then((m) => m.extractPdfPages as unknown as OpFn),
  reorder: () => import("@/lib/pdf/reorder").then((m) => m.reorderPdfPages as unknown as OpFn),
  rotate: () => import("@/lib/pdf/rotate").then((m) => m.rotatePdf as unknown as OpFn),
  "rotate-pages": () => import("@/lib/pdf/rotate").then((m) => m.rotatePdfPages as unknown as OpFn),
  watermark: () => import("@/lib/pdf/watermark").then((m) => m.watermarkPdf as unknown as OpFn),
  "images-to-pdf": () => import("@/lib/pdf/images-to-pdf").then((m) => m.imagesToPdf as unknown as OpFn),
  "pdf-to-images": () => import("@/lib/pdf/pdf-to-images").then((m) => m.pdfToImages as unknown as OpFn),
  compress: () => import("@/lib/pdf/compress").then((m) => m.compressPdf as unknown as OpFn),
};

/** Run an op in the current context (used by the worker and the main-thread fallback). */
export async function runPdfOpInline(
  op: PdfOp,
  files: File[],
  options: unknown,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const loader = loaders[op];
  if (!loader) throw new Error(`Unknown PDF operation: ${op}`);
  const fn = await loader();
  return fn(files, options, ctx);
}
