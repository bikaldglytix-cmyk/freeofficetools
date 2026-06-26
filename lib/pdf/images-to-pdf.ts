import { PDFDocument, type PDFImage } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob } from "@/lib/pdf/core";

export type PageSize = "a4" | "letter" | "fit";
export type Orientation = "portrait" | "landscape";

export interface ImagesToPdfOptions {
  pageSize: PageSize;
  orientation: Orientation;
  /** Margin in points (1/72 inch). */
  margin: number;
}

const SIZES: Record<Exclude<PageSize, "fit">, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

/** Combine JPG/PNG images into a single PDF, one image per page. */
export async function imagesToPdf(
  files: File[],
  options: ImagesToPdfOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  if (!files.length) throw new Error("Add at least one image.");

  const doc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = file.type.includes("png") || file.name.toLowerCase().endsWith(".png");
    let image: PDFImage;
    try {
      image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch {
      throw new Error(`"${file.name}" couldn't be read. Use standard JPG or PNG images.`);
    }

    let pageW: number;
    let pageH: number;
    if (options.pageSize === "fit") {
      pageW = image.width;
      pageH = image.height;
    } else {
      const base = SIZES[options.pageSize];
      const landscape = options.orientation === "landscape";
      pageW = landscape ? base.h : base.w;
      pageH = landscape ? base.w : base.h;
    }

    const page = doc.addPage([pageW, pageH]);
    const margin = options.pageSize === "fit" ? 0 : Math.max(0, options.margin);
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    page.drawImage(image, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });

    ctx?.onProgress?.((i + 1) / files.length);
  }

  const bytes = await doc.save();
  return {
    outputs: [{ name: "images.pdf", blob: bytesToBlob(bytes) }],
    meta: { pages: files.length },
  };
}
