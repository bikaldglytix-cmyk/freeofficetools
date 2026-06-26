import { StandardFonts, degrees, rgb } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, loadDocument } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  /** 0–1 */
  opacity: number;
  /** Hex color like "#1e293b". */
  color: string;
  /** Counter-clockwise degrees, e.g. 45. */
  rotation: number;
}

/** Stamp a diagonal text watermark across every page. */
export async function watermarkPdf(
  files: File[],
  options: WatermarkOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");
  const text = options.text.trim();
  if (!text) throw new Error("Enter the watermark text.");

  const doc = await loadDocument(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const { r, g, b } = hexToRgb(options.color);
  const pages = doc.getPages();
  const theta = (options.rotation * Math.PI) / 180;

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    // Center the text's midpoint at the page center, accounting for rotation.
    const x = width / 2 - (textWidth / 2) * Math.cos(theta);
    const y = height / 2 - (textWidth / 2) * Math.sin(theta);
    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(r, g, b),
      opacity: Math.min(Math.max(options.opacity, 0.02), 1),
      rotate: degrees(options.rotation),
    });
    ctx?.onProgress?.((i + 1) / pages.length);
  });

  const bytes = await doc.save();
  return {
    outputs: [{ name: `${baseName(file.name)}-watermarked.pdf`, blob: bytesToBlob(bytes) }],
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return { r: 0.12, g: 0.16, b: 0.23 };
  const int = parseInt(m[1], 16);
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}
