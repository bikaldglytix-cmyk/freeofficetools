import { PDFDocument } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, loadDocument } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface ReorderOptions {
  /** New page order as 0-based indices into the original document. */
  order: number[];
}

/** Rebuild a PDF with its pages in a new order. */
export async function reorderPdfPages(
  files: File[],
  options: ReorderOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");

  const source = await loadDocument(file);
  const pageCount = source.getPageCount();
  const order = options.order.filter((i) => i >= 0 && i < pageCount);
  if (order.length !== pageCount) {
    throw new Error("The new order must include every page exactly once.");
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, order);
  copied.forEach((page, i) => {
    out.addPage(page);
    ctx?.onProgress?.((i + 1) / copied.length);
  });

  const bytes = await out.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-reordered.pdf`, blob: bytesToBlob(bytes) }],
  };
}
