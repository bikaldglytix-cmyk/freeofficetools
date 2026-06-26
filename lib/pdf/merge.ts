import { PDFDocument } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { PDF_MIME, bytesToBlob, loadDocument } from "@/lib/pdf/core";

/** Merge PDFs in the given file order into a single document. */
export async function mergePdfs(files: File[], _options: void, ctx?: ProcessContext): Promise<ProcessResult> {
  if (files.length < 2) throw new Error("Add at least two PDF files to merge.");

  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const src = await loadDocument(files[i]);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
    ctx?.onProgress?.((i + 1) / files.length);
  }

  const bytes = await merged.save();
  return {
    outputs: [{ name: "merged.pdf", blob: bytesToBlob(bytes, PDF_MIME) }],
    meta: { pages: merged.getPageCount(), files: files.length },
  };
}
