/**
 * Cross-page full-text search with highlight geometry.
 *
 * Strategy: build a per-page index once (concatenated text + a char→item map +
 * each item's bounding box in scale-1 viewport coordinates). Searching is then a
 * cheap substring scan, and each hit is turned into highlight rectangles by
 * mapping the matched character range back onto the item boxes. Partial-item
 * matches are approximated proportionally by character offset, which is accurate
 * enough for visual highlighting of typical left-to-right text.
 *
 * Limitation: bidi/vertical scripts and heavily transformed glyphs get
 * approximate boxes; matches that the PDF splits awkwardly across items may
 * highlight slightly loosely. This is the standard tradeoff for client-side,
 * no-OCR search and is honest about its bounds.
 */
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import type { Rect, SearchMatch, ViewerDocument } from "./types";

interface IndexedItem {
  /** Bounding box in scale-1 viewport coords (top-left origin). */
  rect: Rect;
  /** Length of this item's source string (for proportional sub-rects). */
  length: number;
}

export interface PageTextIndex {
  pageIndex: number;
  /** Lowercased, concatenated page text used for matching. */
  haystack: string;
  /** Original-case text, same offsets, used for snippets. */
  original: string;
  items: IndexedItem[];
  /** For each char in `haystack`: source item index, or -1 for inserted separators. */
  charToItem: Int32Array;
  /** For each char: offset within its source item's string (-1 for separators). */
  charToOffset: Int32Array;
}

/** Multiply two pdf.js affine transforms [a,b,c,d,e,f]. */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Build the searchable index for one page (rects in scale-1 coords). */
export async function buildPageIndex(page: PDFPageProxy, pageIndex: number): Promise<PageTextIndex> {
  const viewport: PageViewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const items: IndexedItem[] = [];
  let original = "";
  const charToItem: number[] = [];
  const charToOffset: number[] = [];

  for (const raw of content.items) {
    // TextMarkedContent entries have no `str`/`transform`; skip them.
    if (!("str" in raw) || typeof raw.str !== "string" || !Array.isArray(raw.transform)) {
      continue;
    }
    const str = raw.str;
    const tx = multiply(viewport.transform as number[], raw.transform as number[]);
    // Glyph height from the transform; width from the reported advance × scale.
    const height = Math.hypot(tx[2], tx[3]) || raw.height || 0;
    const width = (raw.width as number) * viewport.scale;
    const rect: Rect = {
      x: tx[4],
      y: tx[5] - height, // tx maps the baseline; lift to the top of the box
      width,
      height,
    };

    const itemIndex = items.length;
    items.push({ rect, length: str.length });

    for (let c = 0; c < str.length; c++) {
      original += str[c];
      charToItem.push(itemIndex);
      charToOffset.push(c);
    }

    // Insert a soft separator at line ends / between items so adjacent words
    // don't merge into spurious matches. Separators map to no item (-1).
    if (raw.hasEOL || str.length === 0) {
      original += "\n";
    } else {
      original += " ";
    }
    charToItem.push(-1);
    charToOffset.push(-1);
  }

  return {
    pageIndex,
    haystack: original.toLowerCase(),
    original,
    items,
    charToItem: Int32Array.from(charToItem),
    charToOffset: Int32Array.from(charToOffset),
  };
}

/** Build (or rebuild) indexes for every page, reporting fractional progress. */
export async function buildDocumentIndex(
  doc: ViewerDocument,
  onProgress?: (fraction: number) => void,
): Promise<PageTextIndex[]> {
  const indexes: PageTextIndex[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i);
    indexes.push(await buildPageIndex(page, i));
    onProgress?.((i + 1) / doc.numPages);
  }
  return indexes;
}

/** Turn a matched [start,end) char range into highlight rects, grouped by item. */
function rectsForRange(index: PageTextIndex, start: number, end: number): Rect[] {
  const rects: Rect[] = [];
  let i = start;
  while (i < end) {
    const itemIndex = index.charToItem[i];
    if (itemIndex < 0) {
      i++;
      continue;
    }
    // Gather the contiguous run of chars belonging to this same item.
    let j = i;
    const firstOffset = index.charToOffset[i];
    let lastOffset = firstOffset;
    while (j < end && index.charToItem[j] === itemIndex) {
      lastOffset = index.charToOffset[j];
      j++;
    }
    const item = index.items[itemIndex];
    const len = Math.max(1, item.length);
    const startFrac = firstOffset / len;
    const endFrac = (lastOffset + 1) / len;
    rects.push({
      x: item.rect.x + startFrac * item.rect.width,
      y: item.rect.y,
      width: Math.max(1, (endFrac - startFrac) * item.rect.width),
      height: item.rect.height,
    });
    i = j;
  }
  return rects;
}

const SNIPPET_RADIUS = 30;

/** Search all indexed pages for `query` (case-insensitive), in document order. */
export function searchDocument(indexes: PageTextIndex[], query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: SearchMatch[] = [];
  for (const index of indexes) {
    let from = 0;
    for (;;) {
      const at = index.haystack.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      const snippetStart = Math.max(0, at - SNIPPET_RADIUS);
      const snippetEnd = Math.min(index.original.length, end + SNIPPET_RADIUS);
      matches.push({
        id: `${index.pageIndex}:${at}`,
        pageIndex: index.pageIndex,
        start: at,
        end,
        rects: rectsForRange(index, at, end),
        snippet: index.original.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim(),
      });
      from = end;
    }
  }
  return matches;
}
