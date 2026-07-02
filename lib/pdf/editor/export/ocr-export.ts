/**
 * OcrExporter — writes a searchable text layer from a page's OCR layer.
 *
 * For scanned pages, the visible content is a raster image with no text. We draw
 * each OCR word as TEXT positioned over its bounding box. By default the text is
 * INVISIBLE (drawn at opacity 0): the glyphs are present in the content stream so
 * the page becomes searchable/selectable, but nothing is visually added over the
 * scan. `ocrVisible` renders the words faintly for debugging/accessibility.
 *
 * Corrected OCR text is handled transparently — we render whatever text the OCR
 * words currently hold, so corrections made via the state engine flow through.
 *
 * NOTE on invisibility: pdf-lib 1.17 does not expose PDF text render mode 3
 * (invisible) on `drawText`, so we approximate with opacity 0. The text is still
 * fully extractable/searchable; it simply isn't painted. This matches the
 * practical goal of a searchable layer.
 */
import { rgb } from "pdf-lib";
import type { OCRLayer } from "../model/types";
import { mapPoint } from "./geometry";
import type { RenderContext } from "./pdf-writer";

export class OcrExporter {
  render(ctx: RenderContext, layer: OCRLayer | undefined): void {
    if (!ctx.options.includeOcr || !layer || layer.words.length === 0) return;

    const visible = ctx.options.ocrVisible;
    const color = rgb(0, 0, 0);

    for (const word of layer.words) {
      const text = word.text.trim();
      if (!text) continue;
      const { font, text: safe } = ctx.fonts.prepare(
        { family: "Helvetica" },
        text,
        { pageId: ctx.pageId, objectId: word.id },
      );
      const size = Math.max(1, word.rect.height * 0.8);
      // Baseline near the bottom of the word box (top-left origin → +height).
      const baseline = mapPoint(word.rect.x, word.rect.y + word.rect.height * 0.85, ctx.placement);
      ctx.page.drawText(safe, {
        x: baseline.x,
        y: baseline.y,
        size,
        font,
        color,
        opacity: visible ? 0.35 : 0,
      });
    }
  }
}
