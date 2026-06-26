import { rectToQuad } from "./geometry";
import type { Quad } from "./types";

export interface SelectionMapping {
  quads: Quad[];
  text: string;
}

export function selectionToPageQuads(selection: Selection, pageElement: HTMLElement, zoom: number): SelectionMapping | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;
  const pageBox = pageElement.getBoundingClientRect();
  const quads: Quad[] = [];
  const texts: string[] = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    texts.push(range.toString());
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue;
      quads.push(
        rectToQuad({
          x: (rect.left - pageBox.left) / zoom,
          y: (rect.top - pageBox.top) / zoom,
          width: rect.width / zoom,
          height: rect.height / zoom,
        }),
      );
    }
  }
  return quads.length ? { quads: mergeLineQuads(quads), text: texts.join("\n").trim() } : null;
}

export function mergeLineQuads(quads: readonly Quad[]): Quad[] {
  const rects = quads
    .map((q) => ({
      x: Math.min(q.x1, q.x2, q.x3, q.x4),
      y: Math.min(q.y1, q.y2, q.y3, q.y4),
      width: Math.max(q.x1, q.x2, q.x3, q.x4) - Math.min(q.x1, q.x2, q.x3, q.x4),
      height: Math.max(q.y1, q.y2, q.y3, q.y4) - Math.min(q.y1, q.y2, q.y3, q.y4),
    }))
    .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x));

  const lines: typeof rects = [];
  for (const rect of rects) {
    const prev = lines[lines.length - 1];
    if (prev && Math.abs(prev.y - rect.y) <= Math.max(2, prev.height * 0.35)) {
      const right = Math.max(prev.x + prev.width, rect.x + rect.width);
      prev.x = Math.min(prev.x, rect.x);
      prev.y = Math.min(prev.y, rect.y);
      prev.width = right - prev.x;
      prev.height = Math.max(prev.height, rect.height);
    } else {
      lines.push({ ...rect });
    }
  }
  return lines.map(rectToQuad);
}
