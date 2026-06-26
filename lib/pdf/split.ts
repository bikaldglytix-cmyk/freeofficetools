import { PDFDocument } from "pdf-lib";
import type { ProcessContext, ProcessResult, OutputFile } from "@/lib/process/types";
import { bytesToBlob, loadDocument, parseRangeGroups } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface SplitOptions {
  mode: "ranges" | "each";
  /** Required when mode is "ranges", e.g. "1-3, 5, 8-10". */
  ranges?: string;
}

/** Split a single PDF into multiple files by range, or one file per page. */
export async function splitPdf(files: File[], options: SplitOptions, ctx?: ProcessContext): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF to split.");

  const source = await loadDocument(file);
  const pageCount = source.getPageCount();
  const base = baseName(file.name);

  const groups =
    options.mode === "each"
      ? Array.from({ length: pageCount }, (_, i) => ({ label: `${i + 1}`, indices: [i] }))
      : parseRangeGroups(options.ranges ?? "", pageCount);

  if (groups.length === 0) throw new Error("Nothing to split. Check your page ranges.");

  const outputs: OutputFile[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, group.indices);
    copied.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    outputs.push({ name: `${base}-${group.label}.pdf`, blob: bytesToBlob(bytes) });
    ctx?.onProgress?.((i + 1) / groups.length);
  }

  return { outputs, meta: { parts: outputs.length } };
}
