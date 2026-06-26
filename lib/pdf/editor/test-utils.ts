/**
 * Shared builders for the engine tests. Named `test-utils` (not `*.test.ts`) so
 * Vitest does not treat it as a suite.
 */
import { createDocument, createPage, createTextBlock } from "./model/factory";
import type { DocumentState, PageId, Rect, TextBlock } from "./model/types";

export function makeDoc(pageCount = 2): DocumentState {
  const pages = Array.from({ length: pageCount }, () =>
    createPage({ size: { width: 612, height: 792 }, sourcePageIndex: 0 }),
  );
  return createDocument({ fileName: "test.pdf", title: "Test", pages });
}

export const rect = (x = 10, y = 10, width = 100, height = 20): Rect => ({
  x,
  y,
  width,
  height,
});

export function makeText(pageId: PageId, text = "Hello", over: Partial<TextBlock> = {}): TextBlock {
  return { ...createTextBlock({ pageId, rect: rect(), text }), ...over };
}

export function firstPageId(doc: DocumentState): PageId {
  return doc.pageOrder[0];
}
