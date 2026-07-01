import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { newId } from "@/lib/pdf/editor/model/ids";
import type { Matrix, Rect } from "@/lib/pdf/editor/model/types";
import { defaultTextStyle, analyzePdfFont, matchFont } from "./fonts";
import { multiply } from "./geometry";
import { reconstructTextBlocks } from "./reconstruction";
import type { ExtractedTextPage, GlyphRun } from "./types";

interface PdfTextItemLike {
  str: string;
  dir?: string;
  width: number;
  height: number;
  transform: number[];
  fontName?: string;
  hasEOL?: boolean;
}

function isTextItem(value: unknown): value is PdfTextItemLike {
  return (
    !!value &&
    typeof value === "object" &&
    "str" in value &&
    typeof (value as { str: unknown }).str === "string" &&
    Array.isArray((value as { transform?: unknown }).transform)
  );
}

interface FontMeta {
  name?: string;
  bold?: boolean;
  italic?: boolean;
}

interface CommonObjsLike {
  has(key: string): boolean;
  get(key: string): { name?: string; bold?: boolean; italic?: boolean } | null;
}

/**
 * Resolve embedded-font metadata (real name + bold/italic) for the given font
 * ids. The Font objects only exist after the page's operator list is parsed, so
 * we force that first; if anything is unavailable we return what we have and the
 * caller falls back to the generic family. Never throws.
 */
async function loadFontMeta(page: PDFPageProxy, fontIds: string[]): Promise<Map<string, FontMeta>> {
  const map = new Map<string, FontMeta>();
  try {
    await page.getOperatorList();
  } catch {
    return map;
  }
  const objs = (page as unknown as { commonObjs?: CommonObjsLike }).commonObjs;
  if (!objs) return map;
  for (const id of fontIds) {
    try {
      if (objs.has(id)) {
        const f = objs.get(id);
        if (f) map.set(id, { name: f.name, bold: f.bold, italic: f.italic });
      }
    } catch {
      // Font not resolved yet — skip; family falls back to the CSS generic.
    }
  }
  return map;
}

export async function extractPageText(params: {
  page: PDFPageProxy;
  documentId: string;
  pageId: string;
  pageIndex: number;
}): Promise<ExtractedTextPage> {
  const viewport: PageViewport = params.page.getViewport({ scale: 1 });
  const content = await params.page.getTextContent({ includeMarkedContent: true });
  // pdf.js exposes the real font family via `styles[item.fontName].fontFamily`
  // (the per-item `fontName` itself is an opaque id like "g_d0_f3"). Reading the
  // id directly always collapsed to Arial, so edited text lost its serif/mono
  // typeface — resolve the real family here instead.
  const styles =
    (content as { styles?: Record<string, { fontFamily?: string; descent?: number }> }).styles ?? {};
  // The generic CSS family ("serif") carries no weight/style. The embedded
  // font's real name and authoritative bold/italic flags live on the Font
  // object in `page.commonObjs`, populated once the operator list is parsed
  // (the viewer renders pages anyway, so this is normally already cached).
  const fontMeta = await loadFontMeta(params.page, Object.keys(styles));
  const runs: GlyphRun[] = [];

  content.items.forEach((raw, index) => {
    if (!isTextItem(raw) || raw.str.length === 0) return;
    const transform = multiply(viewport.transform as number[], raw.transform) as Matrix;
    const meta = raw.fontName ? fontMeta.get(raw.fontName) : undefined;
    const cssFamily = (raw.fontName && styles[raw.fontName]?.fontFamily) || undefined;
    // Prefer the real embedded name (e.g. "TimesNewRomanPS-BoldMT") for family
    // detection; fall back to the generic CSS family, then the opaque id.
    const ref = analyzePdfFont(meta?.name || cssFamily || raw.fontName);
    const font = matchFont({
      ...ref,
      weight: meta?.bold !== undefined ? (meta.bold ? 700 : 400) : ref.weight,
      style: meta?.italic !== undefined ? (meta.italic ? "italic" : "normal") : ref.style,
    });
    const fontSize = Math.max(1, Math.hypot(transform[2], transform[3]) || raw.height || 12);
    const style = defaultTextStyle({ font, fontSize });
    const height = Math.max(fontSize, raw.height || fontSize);
    const width = Math.max(1, raw.width * viewport.scale);
    const bounds: Rect = {
      x: transform[4],
      y: transform[5] - height,
      width,
      height,
    };
    // bounds bottom is the BASELINE — descenders paint below it. pdf.js reports
    // the font's real descent (negative em fraction) per style; fall back to a
    // conservative 0.24em when the font doesn't say.
    const descentEm = (raw.fontName && styles[raw.fontName]?.descent) || 0;
    const descent = (descentEm < 0 ? Math.min(0.5, -descentEm) : 0.24) * fontSize;
    runs.push({
      id: `pdf_item_${params.pageIndex}_${index}`,
      text: raw.str,
      bounds,
      transform,
      style,
      sourceItemIndex: index,
      charStart: 0,
      charEnd: raw.str.length,
      descent,
    });
  });

  return {
    documentId: params.documentId,
    pageId: params.pageId,
    pageIndex: params.pageIndex,
    width: viewport.width,
    height: viewport.height,
    blocks: reconstructTextBlocks({ documentId: params.documentId, pageId: params.pageId, runs }).map((block, i) => ({
      ...block,
      id: newId(`txt_native_${params.pageIndex}_${i}`),
      zIndex: i,
    })),
    extractedAt: Date.now(),
  };
}

export class TextExtractionCache {
  private pages = new Map<string, Promise<ExtractedTextPage>>();

  get(key: string): Promise<ExtractedTextPage> | undefined {
    return this.pages.get(key);
  }

  set(key: string, value: Promise<ExtractedTextPage>): void {
    this.pages.set(key, value);
  }

  clear(): void {
    this.pages.clear();
  }
}

export const textExtractionCache = new TextExtractionCache();
