import { pointDistance, rectFromPoints } from "./geometry";
import type { Point } from "./types";

export function simplifyPath(points: readonly Point[], tolerance = 1.5): Point[] {
  if (points.length <= 2) return [...points];
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifySection(points, 0, points.length - 1, tolerance, keep);
  return points.filter((_, i) => keep[i]);
}

function simplifySection(points: readonly Point[], first: number, last: number, tolerance: number, keep: boolean[]) {
  let index = first;
  let maxDistance = 0;
  for (let i = first + 1; i < last; i++) {
    const distance = perpendicularDistance(points[i], points[first], points[last]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance <= tolerance) return;
  keep[index] = true;
  simplifySection(points, first, index, tolerance, keep);
  simplifySection(points, index, last, tolerance, keep);
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return pointDistance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

export function smoothPath(points: readonly Point[], smoothing = 0.35): Point[] {
  if (points.length < 3 || smoothing <= 0) return [...points];
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    out.push({
      ...curr,
      x: curr.x * (1 - smoothing) + ((prev.x + next.x) / 2) * smoothing,
      y: curr.y * (1 - smoothing) + ((prev.y + next.y) / 2) * smoothing,
    });
  }
  out.push(points[points.length - 1]);
  return out;
}

export function erasePath(points: readonly Point[], eraser: Point, radius: number): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const point of points) {
    if (pointDistance(point, eraser) <= radius) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export function pathBounds(paths: readonly Point[][], strokeWidth: number) {
  return rectFromPoints(paths.flat(), strokeWidth);
}
