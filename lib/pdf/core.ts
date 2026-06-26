import { PDFDocument } from "pdf-lib";

export const PDF_MIME = "application/pdf";

/** Load a PDF into pdf-lib, tolerating files that are lightly encrypted. */
export async function loadDocument(file: File | ArrayBuffer): Promise<PDFDocument> {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  return PDFDocument.load(data, { ignoreEncryption: true });
}

/** Convert raw bytes to a typed Blob without TS BlobPart friction. */
export function bytesToBlob(bytes: Uint8Array, type = PDF_MIME): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

/**
 * Parse a page selection like "1-3, 5, 8-10" into 0-based indices.
 * Order follows what the user typed; duplicates are removed.
 * Throws a friendly error on invalid input.
 */
export function parsePageList(input: string, pageCount: number): number[] {
  const tokens = input.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) throw new Error("Enter at least one page or range, e.g. 1-3, 5.");

  const seen = new Set<number>();
  const result: number[] = [];

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = token.match(/^(\d+)$/);

    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      assertInRange(start, pageCount);
      assertInRange(end, pageCount);
      for (let p = start; p <= end; p++) addUnique(p - 1, seen, result);
    } else if (singleMatch) {
      const p = parseInt(singleMatch[1], 10);
      assertInRange(p, pageCount);
      addUnique(p - 1, seen, result);
    } else {
      throw new Error(`"${token}" isn't a valid page or range.`);
    }
  }

  if (result.length === 0) throw new Error("No valid pages were selected.");
  return result;
}

/** Parse "1-3, 5, 8-10" into groups, each becoming its own output file. */
export function parseRangeGroups(input: string, pageCount: number): { label: string; indices: number[] }[] {
  const tokens = input.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) throw new Error("Enter at least one page or range, e.g. 1-3, 5.");

  return tokens.map((token) => {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = token.match(/^(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      assertInRange(start, pageCount);
      assertInRange(end, pageCount);
      const indices: number[] = [];
      for (let p = start; p <= end; p++) indices.push(p - 1);
      return { label: `${start}-${end}`, indices };
    }
    if (singleMatch) {
      const p = parseInt(singleMatch[1], 10);
      assertInRange(p, pageCount);
      return { label: `${p}`, indices: [p - 1] };
    }
    throw new Error(`"${token}" isn't a valid page or range.`);
  });
}

function assertInRange(page: number, pageCount: number) {
  if (page < 1 || page > pageCount) {
    throw new Error(`Page ${page} is out of range. This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`);
  }
}

function addUnique(index: number, seen: Set<number>, out: number[]) {
  if (!seen.has(index)) {
    seen.add(index);
    out.push(index);
  }
}

/** Quick page count without keeping the whole document around. */
export async function getPageCount(file: File): Promise<number> {
  const doc = await loadDocument(file);
  return doc.getPageCount();
}
