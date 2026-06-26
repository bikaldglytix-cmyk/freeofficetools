import { degrees } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, loadDocument } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface RotateOptions {
  /** Clockwise degrees to add: 90, 180 or 270. */
  rotation: number;
  /** 0-based page indices to rotate. Omit/empty = all pages. */
  pages?: number[];
}

/** Rotate pages and bake the new orientation into the saved file. */
export async function rotatePdf(files: File[], options: RotateOptions, ctx?: ProcessContext): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF to rotate.");

  const doc = await loadDocument(file);
  const pages = doc.getPages();
  const target = options.pages && options.pages.length ? new Set(options.pages) : null;

  pages.forEach((page, i) => {
    if (target && !target.has(i)) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + options.rotation) % 360));
    ctx?.onProgress?.((i + 1) / pages.length);
  });

  const bytes = await doc.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-rotated.pdf`, blob: bytesToBlob(bytes) }],
  };
}

export interface RotatePagesOptions {
  /** Additive clockwise degrees per page index (0, 90, 180 or 270). */
  rotations: number[];
}

/** Apply a different rotation to each page (used by the visual rotate tool). */
export async function rotatePdfPages(
  files: File[],
  options: RotatePagesOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF to rotate.");

  const doc = await loadDocument(file);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const delta = (((options.rotations[i] ?? 0) % 360) + 360) % 360;
    if (delta) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + delta) % 360));
    }
    ctx?.onProgress?.((i + 1) / pages.length);
  });

  const bytes = await doc.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-rotated.pdf`, blob: bytesToBlob(bytes) }],
  };
}
