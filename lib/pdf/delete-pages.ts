import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, loadDocument } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface DeletePagesOptions {
  /** 0-based page indices to remove. */
  pages: number[];
}

/** Remove the selected pages and keep the rest in their original order. */
export async function deletePdfPages(
  files: File[],
  options: DeletePagesOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");
  if (!options.pages.length) throw new Error("Select at least one page to delete.");

  const doc = await loadDocument(file);
  const total = doc.getPageCount();
  if (options.pages.length >= total) {
    throw new Error("You can't delete every page. Keep at least one.");
  }

  // Remove from the end so indices stay valid as pages are dropped.
  const toRemove = [...new Set(options.pages)].sort((a, b) => b - a);
  toRemove.forEach((index, i) => {
    if (index >= 0 && index < doc.getPageCount()) doc.removePage(index);
    ctx?.onProgress?.((i + 1) / toRemove.length);
  });

  const bytes = await doc.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-edited.pdf`, blob: bytesToBlob(bytes) }],
    meta: { removed: toRemove.length, remaining: doc.getPageCount() },
  };
}
