/**
 * AnnotationFlattener — paints annotation appearances directly onto page content.
 *
 * Handles highlight, note (comment marker), ink (freehand), and shapes
 * (rectangle, ellipse, line, arrow), plus stamps. Driven by {@link FlattenStrategy}:
 *   - "flatten" (default): bake appearances into the page. Universally viewable.
 *   - "keep":   pdf-lib cannot reliably author live, editable annotation widgets
 *               with custom appearance streams, so we still flatten and emit one
 *               info diagnostic. (Documented limitation; the seam to add real
 *               annotations later is `renderAnnotation`.)
 *   - "discard": skip annotations entirely.
 *
 * Signatures are handled by SignatureRenderer; this module ignores them.
 */
import { degrees, rgb } from "pdf-lib";
import { isAnnotation } from "../model/guards";
import type { AnnotationObject, EditableObject, Rect } from "../model/types";
import { parseColor } from "./color";
import { mapPoint, mapPolyline, placeBox, type PdfPoint } from "./geometry";
import type { RenderContext } from "./pdf-writer";

const HIGHLIGHT_OPACITY = 0.4;

export class AnnotationFlattener {
  private keepWarned = false;

  render(ctx: RenderContext, objects: readonly EditableObject[], skip: ReadonlySet<string>): void {
    if (ctx.options.flatten === "discard") return;
    if (ctx.options.flatten === "keep" && !this.keepWarned) {
      ctx.diagnostics.push({
        severity: "info",
        code: "ANNOTATIONS_FLATTENED",
        message:
          'flatten="keep" requested, but pdf-lib cannot author editable annotation widgets reliably; annotations were flattened into page content instead.',
        pageId: ctx.pageId,
      });
      this.keepWarned = true;
    }
    for (const obj of objects) {
      if (skip.has(obj.id) || !isAnnotation(obj)) continue;
      this.draw(ctx, obj);
    }
  }

  /**
   * Render a single annotation. Public so the pipeline can paint in z-order.
   * Honors the flatten strategy (discard → skip; keep → flatten + warn once).
   */
  draw(ctx: RenderContext, a: AnnotationObject): void {
    if (ctx.options.flatten === "discard") return;
    if (ctx.options.flatten === "keep" && !this.keepWarned) {
      ctx.diagnostics.push({
        severity: "info",
        code: "ANNOTATIONS_FLATTENED",
        message:
          'flatten="keep" requested, but pdf-lib cannot author editable annotation widgets reliably; annotations were flattened into page content instead.',
        pageId: ctx.pageId,
      });
      this.keepWarned = true;
    }
    switch (a.annotationType) {
      case "highlight":
        return this.highlight(ctx, a);
      case "ink":
        return this.ink(ctx, a);
      case "shape":
        return this.shape(ctx, a);
      case "note":
        return this.note(ctx, a);
      case "stamp":
        return this.stamp(ctx, a);
    }
  }

  private highlight(ctx: RenderContext, a: AnnotationObject): void {
    const { rgb: color } = parseColor(a.color, { rgb: rgb(1, 0.83, 0), alpha: 1 });
    const quads = a.quadPoints && a.quadPoints.length >= 8 ? quadRects(a.quadPoints) : [a.rect];
    for (const rect of quads) {
      const placed = placeBox(rect, ctx.placement, a.rotation);
      ctx.page.drawRectangle({
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
        rotate: degrees(placed.rotateDeg),
        color,
        opacity: HIGHLIGHT_OPACITY * a.opacity,
      });
    }
  }

  private ink(ctx: RenderContext, a: AnnotationObject): void {
    if (!a.points || a.points.length < 4) return;
    const { rgb: color, alpha } = parseColor(a.color, { rgb: rgb(0, 0, 0), alpha: 1 });
    const pts = mapPolyline(a.points, ctx.placement);
    const thickness = a.strokeWidth ?? 2;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      ctx.page.drawLine({
        start: { x: pts[i], y: pts[i + 1] },
        end: { x: pts[i + 2], y: pts[i + 3] },
        thickness,
        color,
        opacity: Math.min(alpha, a.opacity),
      });
    }
  }

  private shape(ctx: RenderContext, a: AnnotationObject): void {
    const stroke = parseColor(a.color, { rgb: rgb(0, 0, 0), alpha: 1 });
    const fill = a.fill ? parseColor(a.fill) : null;
    const thickness = a.strokeWidth ?? 1.5;
    const op = a.opacity;

    if (a.shape === "line" || a.shape === "arrow") {
      const pts = a.points && a.points.length >= 4 ? a.points : [a.rect.x, a.rect.y, a.rect.x + a.rect.width, a.rect.y + a.rect.height];
      const p0 = mapPoint(pts[0], pts[1], ctx.placement);
      const p1 = mapPoint(pts[2], pts[3], ctx.placement);
      ctx.page.drawLine({ start: p0, end: p1, thickness, color: stroke.rgb, opacity: Math.min(stroke.alpha, op) });
      if (a.shape === "arrow") this.arrowHead(ctx, p0, p1, thickness, stroke.rgb, Math.min(stroke.alpha, op));
      return;
    }

    const placed = placeBox(a.rect, ctx.placement, a.rotation);
    if (a.shape === "ellipse") {
      ctx.page.drawEllipse({
        x: placed.x + placed.width / 2,
        y: placed.y + placed.height / 2,
        xScale: placed.width / 2,
        yScale: placed.height / 2,
        rotate: degrees(placed.rotateDeg),
        borderColor: stroke.rgb,
        borderWidth: thickness,
        borderOpacity: Math.min(stroke.alpha, op),
        color: fill?.rgb,
        opacity: fill ? Math.min(fill.alpha, op) : undefined,
      });
    } else {
      // default + "rectangle"
      ctx.page.drawRectangle({
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
        rotate: degrees(placed.rotateDeg),
        borderColor: stroke.rgb,
        borderWidth: thickness,
        borderOpacity: Math.min(stroke.alpha, op),
        color: fill?.rgb,
        opacity: fill ? Math.min(fill.alpha, op) : undefined,
      });
    }
  }

  private arrowHead(ctx: RenderContext, from: PdfPoint, to: PdfPoint, thickness: number, color: ReturnType<typeof rgb>, opacity: number): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const len = Math.max(6, thickness * 4);
    const spread = Math.PI / 7;
    for (const sign of [1, -1]) {
      const a = angle + Math.PI - sign * spread;
      ctx.page.drawLine({
        start: to,
        end: { x: to.x + len * Math.cos(a), y: to.y + len * Math.sin(a) },
        thickness,
        color,
        opacity,
      });
    }
  }

  private note(ctx: RenderContext, a: AnnotationObject): void {
    // A compact comment marker (a small filled square with a fold). The comment
    // body lives in `a.text`; we don't auto-place it to avoid overlapping content.
    const { rgb: color } = parseColor(a.color, { rgb: rgb(1, 0.85, 0.2), alpha: 1 });
    const size = Math.min(a.rect.width || 16, a.rect.height || 16, 16) || 16;
    const marker: Rect = { x: a.rect.x, y: a.rect.y, width: size, height: size };
    const placed = placeBox(marker, ctx.placement, a.rotation);
    ctx.page.drawRectangle({
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees(placed.rotateDeg),
      color,
      opacity: a.opacity,
      borderColor: rgb(0.4, 0.3, 0),
      borderWidth: 0.75,
    });
  }

  private stamp(ctx: RenderContext, a: AnnotationObject): void {
    const stroke = parseColor(a.color, { rgb: rgb(0.8, 0.1, 0.1), alpha: 1 });
    const placed = placeBox(a.rect, ctx.placement, a.rotation);
    ctx.page.drawRectangle({
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees(placed.rotateDeg),
      borderColor: stroke.rgb,
      borderWidth: a.strokeWidth ?? 2,
      borderOpacity: Math.min(stroke.alpha, a.opacity),
    });
    if (a.text) {
      const { font, text } = ctx.fonts.prepare(
        { family: "Helvetica", bold: true },
        a.text,
        { pageId: ctx.pageId, objectId: a.id },
      );
      const size = Math.min(a.rect.height * 0.5, 14);
      const baseline = mapPoint(a.rect.x + 6, a.rect.y + a.rect.height / 2 + size * 0.35, ctx.placement);
      ctx.page.drawText(text, {
        x: baseline.x,
        y: baseline.y,
        size,
        font,
        color: stroke.rgb,
        opacity: Math.min(stroke.alpha, a.opacity),
      });
    }
  }
}

/** Convert highlight quadPoints (groups of 8 numbers) into bounding rects. */
function quadRects(quad: readonly number[]): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i + 7 < quad.length; i += 8) {
    const xs = [quad[i], quad[i + 2], quad[i + 4], quad[i + 6]];
    const ys = [quad[i + 1], quad[i + 3], quad[i + 5], quad[i + 7]];
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    rects.push({ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y });
  }
  return rects;
}
