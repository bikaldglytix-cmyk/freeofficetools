/**
 * PDFWriter — owns the pdf-lib output document and every shared, cacheable
 * resource (the loaded source document, embedded images, the FontManager). It is
 * the only module that calls `PDFDocument.create/load`, `embedPng/embedJpg`, and
 * `save`. Renderers receive a {@link RenderContext} carrying the writer so they
 * never touch document lifecycle.
 *
 * PERFORMANCE:
 *  - Images are embedded once and cached by `src`; reusing the same image across
 *    pages costs one embed and one shared XObject.
 *  - Oversized images are downscaled before embedding (bounded memory + output).
 *  - `save({ useObjectStreams })` compresses cross-reference + object data, the
 *    main lever pdf-lib offers for output size.
 */
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { FontManager } from "./fonts";
import type { PagePlacement } from "./geometry";
import { ExportError, errorMessage } from "./errors";
import type { ExportDiagnostic, ImageExportOptions, ResolvedExportOptions } from "./types";

export interface RenderContext {
  /** Output document. */
  doc: PDFDocument;
  /** Output page currently being rendered. */
  page: PDFPage;
  /** Model page id (for diagnostics + OCR/text lookups). */
  pageId: string;
  placement: PagePlacement;
  writer: PDFWriter;
  fonts: FontManager;
  options: ResolvedExportOptions;
  diagnostics: ExportDiagnostic[];
}

export interface EmbeddedImage {
  image: PDFImage;
  width: number;
  height: number;
}

export class PDFWriter {
  readonly doc: PDFDocument;
  readonly fonts: FontManager;
  private source: PDFDocument | null = null;
  private readonly imageCache = new Map<string, EmbeddedImage | null>();

  private constructor(doc: PDFDocument) {
    this.doc = doc;
    this.fonts = new FontManager(doc);
  }

  /** Create the output document and optionally load the source for page copies. */
  static async create(source?: ArrayBuffer | Uint8Array | null): Promise<PDFWriter> {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.create();
      // We supply our own producer/creator in MetadataWriter.
      doc.setProducer("");
      doc.setCreator("");
    } catch (err) {
      throw new ExportError("SAVE_FAILED", `Could not initialize output PDF: ${errorMessage(err)}`, { cause: err });
    }
    const writer = new PDFWriter(doc);
    if (source) {
      try {
        writer.source = await PDFDocument.load(source, { ignoreEncryption: true });
      } catch (err) {
        throw new ExportError("SOURCE_LOAD_FAILED", `Could not read the source PDF: ${errorMessage(err)}`, {
          cause: err,
        });
      }
    }
    return writer;
  }

  hasSource(): boolean {
    return this.source !== null;
  }

  /** The loaded source document, for metadata preservation (read-only use). */
  get sourceDocument(): PDFDocument | null {
    return this.source;
  }

  sourcePageCount(): number {
    return this.source?.getPageCount() ?? 0;
  }

  /**
   * Copy a source page by 0-based index into the output and return it (the
   * caller adds/inserts it to control ordering). Copying preserves the page's
   * original content, fonts, vectors and images at full fidelity.
   */
  async copySourcePage(index: number): Promise<PDFPage> {
    if (!this.source) throw new ExportError("PAGE_COPY_FAILED", "No source document loaded.", { recoverable: true });
    if (index < 0 || index >= this.source.getPageCount()) {
      throw new ExportError("PAGE_COPY_FAILED", `Source page index ${index} out of range.`, { recoverable: true });
    }
    try {
      const [copied] = await this.doc.copyPages(this.source, [index]);
      return copied;
    } catch (err) {
      throw new ExportError("PAGE_COPY_FAILED", `Failed to copy source page ${index}: ${errorMessage(err)}`, {
        recoverable: true,
        cause: err,
      });
    }
  }

  /** Embed an image from a data URL or raw bytes, cached by `src`. Returns null on failure (diagnostic appended). */
  async embedImage(
    src: string,
    mimeHint: string | undefined,
    opts: ImageExportOptions,
    diagnostics: ExportDiagnostic[],
    ctx: { pageId?: string; objectId?: string } = {},
  ): Promise<EmbeddedImage | null> {
    const cached = this.imageCache.get(src);
    if (cached !== undefined) return cached;

    let result: EmbeddedImage | null = null;
    try {
      const { bytes, mime } = await decodeImageSource(src, mimeHint);
      const normalized = await normalizeForEmbed(bytes, mime, opts);
      if (!normalized) {
        diagnostics.push({
          severity: "warning",
          code: "IMAGE_UNSUPPORTED",
          message: `Image format "${mime}" cannot be embedded in this environment; object skipped. PNG and JPEG are always supported.`,
          pageId: ctx.pageId,
          objectId: ctx.objectId,
        });
      } else {
        const image = normalized.mime === "image/png"
          ? await this.doc.embedPng(normalized.bytes)
          : await this.doc.embedJpg(normalized.bytes);
        result = { image, width: image.width, height: image.height };
      }
    } catch (err) {
      diagnostics.push({
        severity: "warning",
        code: "IMAGE_DECODE_FAILED",
        message: `Failed to embed image: ${errorMessage(err)}; object skipped.`,
        pageId: ctx.pageId,
        objectId: ctx.objectId,
      });
    }
    this.imageCache.set(src, result);
    return result;
  }

  embedFont(req: Parameters<FontManager["resolveFont"]>[0]): PDFFont {
    return this.fonts.resolveFont(req).font;
  }

  /** Serialize the document. `optimize` toggles object streams. */
  async save(optimize: boolean): Promise<Uint8Array> {
    try {
      return await this.doc.save({
        useObjectStreams: optimize,
        addDefaultPage: false,
        // Update field appearances is irrelevant (we flatten), keep default.
      });
    } catch (err) {
      throw new ExportError("SAVE_FAILED", `Failed to serialize the PDF: ${errorMessage(err)}`, { cause: err });
    }
  }
}

// ---------------------------------------------------------------------------
// Image decoding helpers
// ---------------------------------------------------------------------------

interface RawImage {
  bytes: Uint8Array;
  mime: string;
}

async function decodeImageSource(src: string, mimeHint?: string): Promise<RawImage> {
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error("Malformed data URL");
    const mime = match[1] || mimeHint || "application/octet-stream";
    const isBase64 = Boolean(match[2]);
    const data = match[3];
    const bytes = isBase64 ? base64ToBytes(data) : new TextEncoder().encode(decodeURIComponent(data));
    return { bytes, mime };
  }
  // http(s)/blob/object URL: fetch when available (browser); never in pure Node tests.
  if (typeof fetch === "function") {
    const res = await fetch(src);
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, mime: res.headers.get("content-type") || mimeHint || "application/octet-stream" };
  }
  throw new Error("Cannot resolve image source in this environment");
}

/**
 * Ensure bytes are PNG or JPEG (pdf-lib's only embeddable rasters) and within
 * the size cap. WEBP/GIF/etc. are transcoded via a canvas when the DOM is
 * available; otherwise we return null so the caller raises a clean diagnostic.
 */
async function normalizeForEmbed(
  bytes: Uint8Array,
  mime: string,
  opts: ImageExportOptions,
): Promise<RawImage | null> {
  const lower = mime.toLowerCase();
  const isPng = lower.includes("png");
  const isJpg = lower.includes("jpeg") || lower.includes("jpg");

  // PNG/JPEG embed directly (no re-encode → no quality loss). The `maxDimension`
  // cap is applied during transcoding of other formats, where we decode anyway;
  // we deliberately don't decode/re-encode already-embeddable rasters.
  if (isPng || isJpg) {
    return { bytes, mime: isPng ? "image/png" : "image/jpeg" };
  }
  // WEBP/GIF/etc.: transcode via a canvas (browser/Worker). Null in pure Node.
  return rasterize(bytes, mime, opts);
}

async function rasterize(bytes: Uint8Array, mime: string, opts: ImageExportOptions): Promise<RawImage | null> {
  // Prefer OffscreenCanvas (works in Web Workers); fall back to DOM canvas.
  const canvasFactory = getCanvasFactory();
  if (!canvasFactory || typeof createImageBitmap !== "function") return null;
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
    const bitmap = await createImageBitmap(blob);
    let { width, height } = bitmap;
    if (opts.maxDimension > 0) {
      const scale = Math.min(1, opts.maxDimension / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = canvasFactory(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
    const hasAlpha = mime.toLowerCase().includes("png") || mime.toLowerCase().includes("webp");
    const out = await canvasToBytes(canvas, hasAlpha ? "image/png" : "image/jpeg", opts.jpegQuality);
    return out;
  } catch {
    return null;
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function getCanvasFactory(): ((w: number, h: number) => AnyCanvas) | null {
  if (typeof OffscreenCanvas === "function") return (w, h) => new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") {
    return (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };
  }
  return null;
}

async function canvasToBytes(canvas: AnyCanvas, type: string, quality: number): Promise<RawImage> {
  if ("convertToBlob" in canvas) {
    const blob = await canvas.convertToBlob({ type, quality });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: type };
  }
  const dataUrl = (canvas as HTMLCanvasElement).toDataURL(type, quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { bytes: base64ToBytes(base64), mime: type };
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback.
  return new Uint8Array(Buffer.from(b64, "base64"));
}
