/**
 * Coordinate reconciliation between the model and pdf-lib — the one place that
 * understands both coordinate systems, so renderers never do trig.
 *
 * MODEL space:  PDF points, origin TOP-LEFT, y grows DOWN. Sizes are the page's
 *               *visual* size (the page's intrinsic /Rotate is already baked in,
 *               matching what the viewer renders — see integration/from-viewer).
 * pdf-lib space: PDF points, origin BOTTOM-LEFT, y grows UP, on the page's
 *               UNROTATED media box.
 *
 * For a page with /Rotate ∈ {0,90,180,270}, the unrotated media box differs from
 * the visual box (axes swap at 90/270). `PagePlacement` precomputes everything;
 * `mapPoint` turns a visual point into a pdf-lib point; `placeBox` turns a visual
 * rectangle (+ optional per-object rotation) into a pdf-lib draw anchor + angle
 * usable directly by drawText/drawImage/drawRectangle.
 *
 * Derivation of the four rotation cases lives in the unit tests; each is checked
 * against hand-computed corners.
 */
import type { PageSize, Rect } from "../model/types";

export interface PagePlacement {
  /** Normalized page /Rotate: 0 | 90 | 180 | 270. */
  rotation: 0 | 90 | 180 | 270;
  /** Unrotated media box width (what pdf-lib's mediabox uses). */
  mediaWidth: number;
  /** Unrotated media box height. */
  mediaHeight: number;
  /** Visual width (model space). */
  viewWidth: number;
  /** Visual height (model space). */
  viewHeight: number;
}

export interface PlacedBox {
  /** pdf-lib anchor x (bottom-left of the box in its local pre-rotation frame). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Counter-clockwise degrees for pdf-lib's `rotate`/`degrees()`. */
  rotateDeg: number;
}

export interface PdfPoint {
  x: number;
  y: number;
}

const normalizeRotation = (deg: number): 0 | 90 | 180 | 270 => {
  const r = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return r as 0 | 90 | 180 | 270;
};

/** Build a placement from the model page's visual size + rotation. */
export function placementFor(viewSize: PageSize, rotation: number): PagePlacement {
  const r = normalizeRotation(rotation);
  const swap = r === 90 || r === 270;
  return {
    rotation: r,
    viewWidth: viewSize.width,
    viewHeight: viewSize.height,
    mediaWidth: swap ? viewSize.height : viewSize.width,
    mediaHeight: swap ? viewSize.width : viewSize.height,
  };
}

/** Visual (top-left) point → pdf-lib (bottom-left, unrotated mediabox) point. */
export function mapPoint(vx: number, vy: number, p: PagePlacement): PdfPoint {
  const { mediaWidth: W, mediaHeight: H, rotation } = p;
  switch (rotation) {
    case 0:
      return { x: vx, y: H - vy };
    case 90:
      return { x: vy, y: vx };
    case 180:
      return { x: W - vx, y: vy };
    case 270:
      return { x: W - vy, y: H - vx };
  }
}

/** Rotate a point clockwise (in y-down visual space) about a pivot. */
function rotateCW(px: number, py: number, cx: number, cy: number, deg: number): PdfPoint {
  if (!deg) return { x: px, y: py };
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/**
 * Place a visual rectangle for pdf-lib. `objectRotation` is the object's extra
 * rotation in degrees, clockwise about its top-left corner (model convention).
 *
 * The returned anchor is the pdf-lib bottom-left of the box in its local frame;
 * passing `rotate: degrees(rotateDeg)` plus this anchor and width/height to
 * drawRectangle / drawImage reproduces the visual box exactly, including page
 * rotation and object rotation, with content filling the correct direction.
 */
export function placeBox(rect: Rect, p: PagePlacement, objectRotation = 0): PlacedBox {
  const tlx = rect.x;
  const tly = rect.y;
  // Local frame in visual space: origin = bottom-left, +x → right, +y → up.
  const origin = rotateCW(rect.x, rect.y + rect.height, tlx, tly, objectRotation);
  const xEnd = rotateCW(rect.x + rect.width, rect.y + rect.height, tlx, tly, objectRotation);

  const a = mapPoint(origin.x, origin.y, p);
  const ax = mapPoint(xEnd.x, xEnd.y, p);
  const dx = ax.x - a.x;
  const dy = ax.y - a.y;
  const rotateDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return { x: a.x, y: a.y, width: rect.width, height: rect.height, rotateDeg: normalizeAngle(rotateDeg) };
}

/**
 * Map a baseline point (visual top-left coords, y already at the text baseline)
 * to a pdf-lib draw origin, returning the matching rotation for drawText.
 * `objectRotation` rotates about `pivot` (the block's top-left).
 */
export function placeBaseline(
  point: PdfPoint,
  pivot: PdfPoint,
  p: PagePlacement,
  objectRotation = 0,
): { x: number; y: number; rotateDeg: number } {
  const rotated = rotateCW(point.x, point.y, pivot.x, pivot.y, objectRotation);
  const mapped = mapPoint(rotated.x, rotated.y, p);
  // Text advances along +x of the (rotated) visual frame; derive that direction.
  const along = rotateCW(point.x + 1, point.y, pivot.x, pivot.y, objectRotation);
  const alongMapped = mapPoint(along.x, along.y, p);
  const rotateDeg = (Math.atan2(alongMapped.y - mapped.y, alongMapped.x - mapped.x) * 180) / Math.PI;
  return { x: mapped.x, y: mapped.y, rotateDeg: normalizeAngle(rotateDeg) };
}

/** Map a flat [x0,y0,x1,y1,...] polyline (absolute visual coords) to pdf space. */
export function mapPolyline(points: readonly number[], p: PagePlacement): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const m = mapPoint(points[i], points[i + 1], p);
    out.push(m.x, m.y);
  }
  return out;
}

/** True if a rect lies (even partly) within the visual page bounds. */
export function rectIntersectsPage(rect: Rect, p: PagePlacement): boolean {
  return (
    rect.x < p.viewWidth &&
    rect.y < p.viewHeight &&
    rect.x + rect.width > 0 &&
    rect.y + rect.height > 0
  );
}

function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  // Snap tiny FP noise to clean multiples (helps deterministic output).
  const snapped = Math.round(a);
  return Math.abs(a - snapped) < 1e-6 ? snapped : a;
}
