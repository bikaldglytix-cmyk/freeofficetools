/**
 * ImageRenderer — draws inserted/moved/resized/rotated images.
 *
 * PNG and JPEG embed natively (PNG alpha is preserved). WEBP/GIF/others are
 * transcoded via a canvas when one is available (browser/Worker); in pure Node
 * they raise an IMAGE_UNSUPPORTED diagnostic and are skipped — see
 * `pdf-writer.ts`. Object-level `opacity` is applied as a constant alpha; full
 * per-pixel transparency comes from the source PNG itself.
 */
import { degrees } from "pdf-lib";
import { isImageObject } from "../model/guards";
import type { EditableObject, ImageObject } from "../model/types";
import { placeBox } from "./geometry";
import type { RenderContext } from "./pdf-writer";

export class ImageRenderer {
  async render(ctx: RenderContext, objects: readonly EditableObject[], skip: ReadonlySet<string>): Promise<void> {
    for (const obj of objects) {
      if (skip.has(obj.id) || !isImageObject(obj)) continue;
      await this.draw(ctx, obj);
    }
  }

  /** Render a single image. Public so the pipeline can paint in z-order. */
  async draw(ctx: RenderContext, obj: ImageObject): Promise<void> {
    const embedded = await ctx.writer.embedImage(obj.src, obj.mimeType, ctx.options.image, ctx.diagnostics, {
      pageId: ctx.pageId,
      objectId: obj.id,
    });
    if (!embedded) return; // diagnostic already recorded

    const placed = placeBox(obj.rect, ctx.placement, obj.rotation);
    ctx.page.drawImage(embedded.image, {
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees(placed.rotateDeg),
      opacity: clamp01(obj.opacity),
    });
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
