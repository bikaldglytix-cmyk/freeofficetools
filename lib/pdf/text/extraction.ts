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

export async function extractPageText(params: {
  page: PDFPageProxy;
  documentId: string;
  pageId: string;
  pageIndex: number;
}): Promise<ExtractedTextPage> {
  const viewport: PageViewport = params.page.getViewport({ scale: 1 });
  const content = await params.page.getTextContent({ includeMarkedContent: true });
  const runs: GlyphRun[] = [];

  content.items.forEach((raw, index) => {
    if (!isTextItem(raw) || raw.str.length === 0) return;
    const transform = multiply(viewport.transform as number[], raw.transform) as Matrix;
    const font = matchFont(analyzePdfFont(raw.fontName));
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
    runs.push({
      id: `pdf_item_${params.pageIndex}_${index}`,
      text: raw.str,
      bounds,
      transform,
      style,
      sourceItemIndex: index,
      charStart: 0,
      charEnd: raw.str.length,
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
