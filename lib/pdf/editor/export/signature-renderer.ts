/**
 * SignatureRenderer — renders drawn, typed, and uploaded-image signatures.
 *  - draw / image: embed the PNG/JPEG payload and place it (scale + rotation +
 *    opacity from the object). Drawn signatures are transparent PNGs, so the
 *    pen strokes composite cleanly over page content.
 *  - typed: render the name with an italic standard font scaled to the box.
 *
 * Signatures always render as flattened content regardless of FlattenStrategy —
 * a signature is a visual mark, not an interactive annotation.
 */
import { degrees, rgb } from "pdf-lib";
import { isSignature } from "../model/guards";
import type { EditableObject, SignatureObject } from "../model/types";
import { parseColor } from "./color";
import { mapPoint, placeBaseline, placeBox } from "./geometry";
import type { RenderContext } from "./pdf-writer";

export class SignatureRenderer {
  async render(ctx: RenderContext, objects: readonly EditableObject[], skip: ReadonlySet<string>): Promise<void> {
    for (const obj of objects) {
      if (skip.has(obj.id) || !isSignature(obj)) continue;
      await this.draw(ctx, obj);
    }
  }

  /** Render a single signature. Public so the pipeline can paint in z-order. */
  async draw(ctx: RenderContext, sig: SignatureObject): Promise<void> {
    if (sig.signatureType === "typed") this.typed(ctx, sig);
    else await this.image(ctx, sig);
  }

  private async image(ctx: RenderContext, sig: SignatureObject): Promise<void> {
    if (!sig.src) return;
    const embedded = await ctx.writer.embedImage(sig.src, undefined, ctx.options.image, ctx.diagnostics, {
      pageId: ctx.pageId,
      objectId: sig.id,
    });
    if (!embedded) return;
    const placed = placeBox(sig.rect, ctx.placement, sig.rotation);
    ctx.page.drawImage(embedded.image, {
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees(placed.rotateDeg),
      opacity: Math.min(1, Math.max(0, sig.opacity)),
    });
  }

  private typed(ctx: RenderContext, sig: SignatureObject): void {
    if (!sig.text) return;
    const { font } = ctx.fonts.resolveFont({ family: sig.fontFamily ?? "Times", italic: true });
    const text = ctx.fonts.sanitize(sig.text, { pageId: ctx.pageId, objectId: sig.id });
    const { rgb: color } = parseColor(sig.strokeColor, { rgb: rgb(0.05, 0.1, 0.4), alpha: 1 });

    // Fit the text to the box: cap by height, then shrink if wider than the box.
    let size = sig.rect.height * 0.7;
    const width = ctx.fonts.widthOf(font, text, size);
    if (width > sig.rect.width && width > 0) size *= sig.rect.width / width;

    const baselineY = sig.rect.y + sig.rect.height * 0.72;
    const pivot = mapPoint(sig.rect.x, sig.rect.y, ctx.placement);
    const placed = placeBaseline({ x: sig.rect.x + 2, y: baselineY }, pivot, ctx.placement, sig.rotation);
    ctx.page.drawText(text, {
      x: placed.x,
      y: placed.y,
      size,
      font,
      color,
      opacity: Math.min(1, Math.max(0, sig.opacity)),
      rotate: degrees(placed.rotateDeg),
    });
  }
}
