import type { Rect } from "@/lib/pdf/editor/model/types";
import type { Point, Quad } from "./types";

export const MIN_ANNOTATION_SIZE = 4;

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(MIN_ANNOTATION_SIZE, Math.abs(a.x - b.x)),
    height: Math.max(MIN_ANNOTATION_SIZE, Math.abs(a.y - b.y)),
  };
}

export function rectFromPoints(points: readonly Point[], padding = 0): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(MIN_ANNOTATION_SIZE, maxX - minX + padding * 2),
    height: Math.max(MIN_ANNOTATION_SIZE, maxY - minY + padding * 2),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: rect.x + dx, y: rect.y + dy };
}

export function scaleRect(rect: Rect, scale: number): Rect {
  return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
}

export function clampRectToPage(rect: Rect, page: { width: number; height: number }): Rect {
  const width = Math.min(rect.width, page.width);
  const height = Math.min(rect.height, page.height);
  return {
    x: Math.max(0, Math.min(page.width - width, rect.x)),
    y: Math.max(0, Math.min(page.height - height, rect.y)),
    width,
    height,
  };
}

export function rectToQuad(rect: Rect): Quad {
  return {
    x1: rect.x,
    y1: rect.y,
    x2: rect.x + rect.width,
    y2: rect.y,
    x3: rect.x + rect.width,
    y3: rect.y + rect.height,
    x4: rect.x,
    y4: rect.y + rect.height,
  };
}

export function quadToRect(quad: Quad): Rect {
  const xs = [quad.x1, quad.x2, quad.x3, quad.x4];
  const ys = [quad.y1, quad.y2, quad.y3, quad.y4];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function quadsToBounds(quads: readonly Quad[]): Rect {
  return rectFromPoints(
    quads.flatMap((q) => [
      { x: q.x1, y: q.y1 },
      { x: q.x2, y: q.y2 },
      { x: q.x3, y: q.y3 },
      { x: q.x4, y: q.y4 },
    ]),
  );
}

export function toPdfPoint(clientX: number, clientY: number, element: HTMLElement, zoom: number): Point {
  const box = element.getBoundingClientRect();
  return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom, time: Date.now() };
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
