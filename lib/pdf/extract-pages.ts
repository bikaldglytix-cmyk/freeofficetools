import { PDFDocument } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, loadDocument } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface ExtractPagesOptions {
  /** 0-based page indices to keep, in the desired order. */
  pages: number[];
}

/** Build a new PDF containing only the selected pages. */
export async function extractPdfPages(
  files: File[],
  options: ExtractPagesOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");
  if (!options.pages.length) throw new Error("Select at least one page to extract.");

  const source = await loadDocument(file);
  const pageCount = source.getPageCount();
  const indices = options.pages.filter((i) => i >= 0 && i < pageCount);
  if (!indices.length) throw new Error("None of the selected pages exist in this PDF.");

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, indices);
  copied.forEach((page, i) => {
    out.addPage(page);
    ctx?.onProgress?.((i + 1) / copied.length);
  });

  const bytes = await out.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-pages.pdf`, blob: bytesToBlob(bytes) }],
    meta: { extracted: indices.length },
  };
}
