import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import type { ProcessContext, ProcessResult } from "@/lib/process/types";
import { bytesToBlob, PDF_MIME } from "@/lib/pdf/core";
import { baseName } from "@/lib/files";
import { readJpegInfo } from "@/lib/pdf/jpeg";

export interface CompressOptions {
  /** Cap an image's longest side (px) for the chosen level. */
  maxDim: number;
  /** JPEG quality 0–1 for re-encoded images. */
  quality: number;
  /** Optional hard size cap in bytes; the engine gets as close below it as it can. */
  targetBytes?: number;
}

export interface CompressMeta {
  originalSize: number;
  newSize: number;
  savedPercent: number;
  /** True only when nothing we tried could beat the original size. */
  alreadyOptimized?: boolean;
  targetBytes?: number;
  /** True when the output is at/under the requested target (and smaller than the original). */
  targetReached?: boolean;
  /** Win came purely from a lossless structural re-save (no image quality lost at all). */
  lossless?: boolean;
  /** How many embedded images were recompressed. */
  imagesRecompressed?: number;
}

/**
 * Compress a PDF **without rasterizing** — text stays real text (selectable,
 * searchable, copyable) and vector graphics stay vector. Two levers, both
 * structure-preserving:
 *   1. A lossless re-save (object streams + deflate) that drops bloat with zero
 *      quality loss.
 *   2. Recompressing the *embedded raster images* in place: decode each JPEG
 *      (DCTDecode) image, downsample over-large ones and re-encode at a lower
 *      quality, then swap the stream back in. Non-JPEG / CMYK / masked images are
 *      left untouched, so the document is never corrupted.
 *
 * Target mode searches an image-quality ladder for the gentlest setting that
 * lands under the requested size; level mode maps a preset and escalates only if
 * needed. Output is never larger than the input, and is verified to re-open.
 */
export async function compressPdf(
  files: File[],
  options: CompressOptions,
  ctx?: ProcessContext,
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Add a PDF first.");

  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const originalSize = originalBytes.byteLength;
  const report = (p: number) => ctx?.onProgress?.(Math.max(0, Math.min(0.99, p)));

  // A pristine re-save: preserves everything, just packs it tighter.
  const buildLossless = async (): Promise<Uint8Array | null> => {
    try {
      const doc = await PDFDocument.load(originalBytes.slice());
      return await doc.save({ useObjectStreams: true });
    } catch {
      return null;
    }
  };

  // Re-save with embedded JPEGs downsampled + recompressed. Text/vectors are
  // untouched. Returns the bytes and how many images changed (0 ⇒ no image win).
  const buildImageOptimized = async (
    maxDim: number,
    quality: number,
  ): Promise<{ bytes: Uint8Array; images: number } | null> => {
    try {
      const doc = await PDFDocument.load(originalBytes.slice());
      const images = await recompressJpegImages(doc, maxDim, quality, report);
      const bytes = await doc.save({ useObjectStreams: true });
      return { bytes, images };
    } catch {
      return null;
    }
  };

  const finalize = async (bytes: Uint8Array, extra: Partial<CompressMeta>): Promise<ProcessResult> => {
    // Never hand back something that can't be opened.
    if (bytes !== originalBytes) {
      try {
        await PDFDocument.load(bytes);
      } catch {
        bytes = originalBytes;
        extra = { alreadyOptimized: true };
      }
    }
    const newSize = bytes.byteLength;
    const meta = {
      originalSize,
      newSize,
      savedPercent: originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0,
      ...extra,
    } satisfies CompressMeta;
    const name = bytes === originalBytes ? `${baseName(file.name)}.pdf` : `${baseName(file.name)}-compressed.pdf`;
    return { outputs: [{ name, blob: bytesToBlob(bytes, PDF_MIME) }], meta };
  };

  const lossless = await buildLossless();
  const target = options.targetBytes;

  // ---------------- Target-size mode ----------------
  if (target && target > 0) {
    // Lossless already fits? Take it — zero quality loss.
    if (lossless && lossless.byteLength <= target && lossless.byteLength < originalSize) {
      return finalize(lossless, { targetBytes: target, targetReached: true, lossless: true, imagesRecompressed: 0 });
    }
    let best: Uint8Array = originalBytes;
    let bestImages = 0;
    if (lossless && lossless.byteLength < best.byteLength) best = lossless;
    for (const rung of LADDER) {
      const built = await buildImageOptimized(rung.maxDim, rung.quality);
      if (built && built.bytes.byteLength < best.byteLength) {
        best = built.bytes;
        bestImages = built.images;
      }
      if (best.byteLength <= target && best !== originalBytes) break; // gentlest rung that fits
    }
    if (best === originalBytes) {
      return finalize(originalBytes, { targetBytes: target, targetReached: false, alreadyOptimized: true });
    }
    return finalize(best, {
      targetBytes: target,
      targetReached: best.byteLength <= target,
      lossless: best === lossless,
      imagesRecompressed: best === lossless ? 0 : bestImages,
    });
  }

  // ---------------- Level mode (no target) ----------------
  let best: Uint8Array = originalBytes;
  let bestImages = 0;
  if (lossless && lossless.byteLength < best.byteLength) best = lossless;

  const optimized = await buildImageOptimized(options.maxDim, options.quality);
  if (optimized && optimized.bytes.byteLength < best.byteLength) {
    best = optimized.bytes;
    bestImages = optimized.images;
  }

  if (best === originalBytes || best.byteLength >= originalSize) {
    return finalize(originalBytes, { alreadyOptimized: true });
  }
  return finalize(best, { lossless: best === lossless, imagesRecompressed: best === lossless ? 0 : bestImages });
}

/** Image-quality ladder for target search, gentle → aggressive. */
const LADDER: ReadonlyArray<{ maxDim: number; quality: number }> = [
  { maxDim: 2200, quality: 0.8 },
  { maxDim: 1800, quality: 0.7 },
  { maxDim: 1500, quality: 0.6 },
  { maxDim: 1200, quality: 0.5 },
  { maxDim: 1000, quality: 0.42 },
  { maxDim: 800, quality: 0.34 },
];

/**
 * Recompress every safe embedded JPEG image in `doc` in place. Returns the count
 * changed. Each image is handled defensively: any failure skips that one image
 * and leaves it exactly as it was, so the document can never be corrupted.
 */
async function recompressJpegImages(
  doc: PDFDocument,
  maxDim: number,
  quality: number,
  report: (p: number) => void,
): Promise<number> {
  const entries = doc.context.enumerateIndirectObjects();
  const images = entries.filter(([, obj]) => obj instanceof PDFRawStream && isJpegImage(obj as PDFRawStream));
  let changed = 0;
  for (let n = 0; n < images.length; n++) {
    report(0.05 + (n / Math.max(1, images.length)) * 0.85);
    const [ref, obj] = images[n];
    const stream = obj as PDFRawStream;
    try {
      const info = readJpegInfo(stream.contents);
      if (!info || info.components === 4) continue; // skip CMYK — canvas can't re-encode it faithfully
      const out = await recompressJpeg(stream.contents, maxDim, quality);
      if (!out || out.bytes.byteLength >= stream.contents.byteLength) continue; // no win → leave original
      const dict = stream.dict;
      dict.set(PDFName.of("Width"), PDFNumber.of(out.width));
      dict.set(PDFName.of("Height"), PDFNumber.of(out.height));
      dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
      dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
      dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
      dict.set(PDFName.of("Length"), PDFNumber.of(out.bytes.byteLength));
      dict.delete(PDFName.of("DecodeParms"));
      dict.delete(PDFName.of("Decode"));
      doc.context.assign(ref, PDFRawStream.of(dict, out.bytes));
      changed++;
    } catch {
      // leave this image untouched
    }
  }
  return changed;
}

/** Is this stream an image XObject encoded purely with DCTDecode (JPEG)? */
function isJpegImage(stream: PDFRawStream): boolean {
  const dict = stream.dict;
  const subtype = dict.get(PDFName.of("Subtype"));
  if (!(subtype instanceof PDFName) || subtype.asString() !== "/Image") return false;
  if (dict.get(PDFName.of("ImageMask"))) return false; // 1-bit stencil mask, not a photo
  const filter = dict.get(PDFName.of("Filter"));
  if (filter instanceof PDFName) return filter.asString() === "/DCTDecode";
  // A filter array is only safe to treat as JPEG if DCTDecode is the sole filter.
  if (filter instanceof PDFArray) {
    const list = filter.asArray();
    return list.length === 1 && list[0] instanceof PDFName && list[0].asString() === "/DCTDecode";
  }
  return false;
}

/** Decode a JPEG, optionally downsample, and re-encode at `quality`. */
async function recompressJpeg(
  src: Uint8Array,
  maxDim: number,
  quality: number,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  if (typeof document === "undefined") return null;
  const blob = new Blob([src as unknown as BlobPart], { type: "image/jpeg" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) return null;
    const longest = Math.max(w, h);
    if (longest > maxDim) {
      const k = maxDim / longest;
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext("2d");
    if (!cx) return null;
    cx.drawImage(img, 0, 0, w, h);
    const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!outBlob) return null;
    return { bytes: new Uint8Array(await outBlob.arrayBuffer()), width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = url;
  });
}
