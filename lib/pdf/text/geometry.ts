import type { Matrix, Rect } from "@/lib/pdf/editor/model/types";

export interface Point {
  x: number;
  y: number;
}

export function multiply(a: readonly number[], b: readonly number[]): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function unionRects(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

export function viewportToPdfRect(rect: Rect, zoom: number): Rect {
  return { x: rect.x / zoom, y: rect.y / zoom, width: rect.width / zoom, height: rect.height / zoom };
}

export function pdfToViewportRect(rect: Rect, zoom: number): Rect {
  return { x: rect.x * zoom, y: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom };
}

export function clientPointToPdfPoint(clientX: number, clientY: number, pageElement: HTMLElement, zoom: number): Point {
  const box = pageElement.getBoundingClientRect();
  return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom };
}

export function rectIntersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function clampRect(rect: Rect, page: { width: number; height: number }): Rect {
  const width = Math.max(4, Math.min(rect.width, page.width));
  const height = Math.max(4, Math.min(rect.height, page.height));
  return {
    x: Math.max(0, Math.min(page.width - width, rect.x)),
    y: Math.max(0, Math.min(page.height - height, rect.y)),
    width,
    height,
  };
}
