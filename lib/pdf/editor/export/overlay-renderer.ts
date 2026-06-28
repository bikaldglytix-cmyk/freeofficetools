/**
 * OverlayRenderer — the whiteout/restamp + redaction stage.
 *
 * WHITEOUT/RESTAMP: unedited original text stays inside the copied source page
 * at 100% fidelity. When the user edits original text, the state engine keeps a
 * `TextBlock` with `source: "original"` in the model carrying the original bounds
 * (`originalItemIds` ties it back to the source). At export we paint an opaque
 * mask over those original bounds so the old glyphs disappear, then the
 * TextRenderer stamps the new text on top. This module only paints the masks;
 * TextRenderer handles the restamped text (run order in the pipeline guarantees
 * masks are laid down first).
 *
 * REDACTION — FREE-LIBRARY LIMITATION (security-relevant, documented loudly):
 * pdf-lib can only PAINT OVER content; it cannot remove the underlying text/image
 * operators from a copied page. A redaction box is therefore VISUALLY opaque but
 * the covered text may still be extractable from the file. For true redaction the
 * page must be rasterized (losing vector text) or processed by a library that can
 * rewrite content streams. When `removeUnderlying` is set we emit a high-severity
 * diagnostic so callers can warn the user or choose a raster fallback.
 */
import { degrees, rgb } from "pdf-lib";
import { isRedaction, isTextBlock } from "../model/guards";
import type { EditableObject, RedactionObject, Rect, TextBlock } from "../model/types";
import { parseColor } from "./color";
import { placeBox } from "./geometry";
import type { RenderContext } from "./pdf-writer";

/** Padding (pt) added around a whiteout mask to cover glyph antialiasing. */
const WHITEOUT_PAD = 1.25;

export class OverlayRenderer {
  /** Paint whiteout masks + redaction boxes for one page's objects (in z-order). */
  render(ctx: RenderContext, objects: readonly EditableObject[], skip: ReadonlySet<string>): void {
    for (const obj of objects) {
      if (skip.has(obj.id)) continue;
      if (isTextBlock(obj) && obj.source === "original") {
        this.whiteout(ctx, obj);
      } else if (isRedaction(obj)) {
        this.redact(ctx, obj);
      }
    }
  }

  private whiteout(ctx: RenderContext, block: TextBlock): void {
    const masks = whiteoutRects(block);
    const exp = block.metadata?.export as { whiteout?: { fill?: string } } | undefined;
    const color = exp?.whiteout?.fill ?? (block.metadata?.whiteoutColor as string | undefined) ?? "#ffffff";
    const { rgb: fill } = parseColor(color, { rgb: rgb(1, 1, 1), alpha: 1 });
    for (const rect of masks) {
      const placed = placeBox(rect, ctx.placement, block.rotation);
      ctx.page.drawRectangle({
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
        rotate: degrees(placed.rotateDeg),
        color: fill,
        opacity: 1,
      });
    }
  }

  private redact(ctx: RenderContext, redaction: RedactionObject): void {
    const { rgb: fill, alpha } = parseColor(redaction.fillColor, { rgb: rgb(0, 0, 0), alpha: 1 });
    const placed = placeBox(redaction.rect, ctx.placement, redaction.rotation);
    ctx.page.drawRectangle({
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees(placed.rotateDeg),
      color: fill,
      opacity: Math.min(alpha, redaction.opacity),
    });
    if (redaction.removeUnderlying) {
      ctx.diagnostics.push({
        severity: "warning",
        code: "REDACTION_VISUAL_ONLY",
        message:
          "Redaction is painted as an opaque box but the underlying content is NOT removed from the file and may remain extractable. Rasterize the page for true redaction.",
        pageId: ctx.pageId,
        objectId: redaction.id,
      });
    }
  }
}

/**
 * The rectangles to mask for an edited original block. Prefer the per-line
 * bounds the text engine records on `metadata.export.whiteout.bounds` (so
 * multi-line / sparse edits don't over-paint and the mask stays pinned to the
 * ORIGINAL glyph positions even if the user moves the replacement box). Fall
 * back to the legacy `metadata.whiteoutBounds` key, then the padded block rect.
 */
export function whiteoutRects(block: TextBlock): Rect[] {
  const exp = block.metadata?.export as { whiteout?: { bounds?: Rect[] } } | undefined;
  const fromExport = exp?.whiteout?.bounds;
  const legacy = block.metadata?.whiteoutBounds as Rect[] | undefined;
  const rects =
    Array.isArray(fromExport) && fromExport.length
      ? fromExport
      : Array.isArray(legacy) && legacy.length
        ? legacy
        : [block.rect];
  return rects.map(pad);
}

function pad(r: Rect): Rect {
  return {
    x: r.x - WHITEOUT_PAD,
    y: r.y - WHITEOUT_PAD,
    width: r.width + WHITEOUT_PAD * 2,
    height: r.height + WHITEOUT_PAD * 2,
  };
}
