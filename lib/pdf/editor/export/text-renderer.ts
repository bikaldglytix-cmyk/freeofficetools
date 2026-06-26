/**
 * TextRenderer — draws added and edited text (the restamp half of the
 * whiteout/restamp workflow). Original, unedited text is never re-drawn; it stays
 * in the copied source page.
 *
 * Features: greedy word-wrap to the block width, hard `\n` breaks, alignment
 * (left/center/right/justify), per-run styling (font family / weight / italic /
 * size / color / underline), opacity, page rotation and per-object rotation.
 *
 * Font fidelity is bounded by the standard-font limitation documented in
 * `fonts.ts`; geometry/wrapping/alignment are exact.
 */
import { degrees } from "pdf-lib";
import type { PDFFont, RGB } from "pdf-lib";
import { isTextBlock } from "../model/guards";
import type { EditableObject, TextBlock, TextRun } from "../model/types";
import { parseColor } from "./color";
import { placeBaseline, mapPoint } from "./geometry";
import type { RenderContext } from "./pdf-writer";

interface StyleResolved {
  font: PDFFont;
  size: number;
  color: RGB;
  alpha: number;
  underline: boolean;
}

interface Word {
  text: string;
  style: StyleResolved;
  width: number;
}

interface Line {
  words: Word[];
  spaceWidth: number;
  width: number;
}

export class TextRenderer {
  render(ctx: RenderContext, objects: readonly EditableObject[], skip: ReadonlySet<string>): void {
    for (const obj of objects) {
      if (skip.has(obj.id) || !isTextBlock(obj)) continue;
      this.draw(ctx, obj);
    }
  }

  /** Render a single text block. Public so the pipeline can paint in z-order. */
  draw(ctx: RenderContext, block: TextBlock): void {
    const words = this.tokenize(ctx, block);
    if (words.length === 0) return;

    const lineStep = block.fontSize * (block.lineHeight || 1.2);
    const ascent = block.fontSize * 0.8; // good standard-font approximation
    const lines = wrap(words, block.rect.width, this.spaceWidthFor(ctx, block));

    const pivot = mapPoint(block.rect.x, block.rect.y, ctx.placement);

    lines.forEach((line, i) => {
      const baselineY = block.rect.y + ascent + i * lineStep;
      const isLast = i === lines.length - 1;
      let cursorX = block.rect.x + alignOffset(block.align, block.rect.width, line.width);
      const justify = block.align === "justify" && !isLast && line.words.length > 1;
      const gap = justify
        ? line.spaceWidth + (block.rect.width - line.width) / (line.words.length - 1)
        : line.spaceWidth;

      line.words.forEach((word, wi) => {
        const placed = placeBaseline({ x: cursorX, y: baselineY }, pivot, ctx.placement, block.rotation);
        ctx.page.drawText(word.text, {
          x: placed.x,
          y: placed.y,
          size: word.style.size,
          font: word.style.font,
          color: word.style.color,
          opacity: Math.min(block.opacity, word.style.alpha),
          rotate: degrees(placed.rotateDeg),
        });
        if (word.style.underline) {
          this.underline(ctx, cursorX, baselineY, word, pivot, block);
        }
        cursorX += word.width + (wi < line.words.length - 1 ? gap : 0);
      });
    });
  }

  /** Split block text (or runs) into measured, styled words. */
  private tokenize(ctx: RenderContext, block: TextBlock): Word[] {
    const segments: { text: string; run?: TextRun }[] =
      block.runs && block.runs.length
        ? block.runs.map((r) => ({ text: r.text, run: r }))
        : [{ text: block.text }];

    const out: Word[] = [];
    for (const seg of segments) {
      const style = this.resolveStyle(ctx, block, seg.run);
      // Preserve hard line breaks as sentinel words.
      const parts = seg.text.split(/(\n)/);
      for (const part of parts) {
        if (part === "\n") {
          out.push({ text: "\n", style, width: 0 });
          continue;
        }
        for (const token of part.split(/\s+/)) {
          if (!token) continue;
          const text = ctx.fonts.sanitize(token, { pageId: ctx.pageId, objectId: block.id });
          out.push({ text, style, width: ctx.fonts.widthOf(style.font, text, style.size) });
        }
      }
    }
    return out;
  }

  private resolveStyle(ctx: RenderContext, block: TextBlock, run?: TextRun): StyleResolved {
    const family = run?.fontFamily ?? block.fontFamily;
    const bold = run?.bold ?? /bold|black|heavy|semibold|demi/i.test(family);
    const italic = run?.italic ?? /italic|oblique/i.test(family);
    const { font } = ctx.fonts.resolveFont({ family, bold, italic });
    const { rgb: color, alpha } = parseColor(run?.color ?? block.color);
    return {
      font,
      size: run?.fontSize ?? block.fontSize,
      color,
      alpha,
      underline: run?.underline ?? false,
    };
  }

  private spaceWidthFor(ctx: RenderContext, block: TextBlock): number {
    const { font } = ctx.fonts.resolveFont({ family: block.fontFamily });
    return ctx.fonts.widthOf(font, " ", block.fontSize);
  }

  private underline(
    ctx: RenderContext,
    startX: number,
    baselineY: number,
    word: Word,
    pivot: { x: number; y: number },
    block: TextBlock,
  ): void {
    const y = baselineY + word.style.size * 0.12;
    const a = placeBaseline({ x: startX, y }, pivot, ctx.placement, block.rotation);
    const b = placeBaseline({ x: startX + word.width, y }, pivot, ctx.placement, block.rotation);
    ctx.page.drawLine({
      start: { x: a.x, y: a.y },
      end: { x: b.x, y: b.y },
      thickness: Math.max(0.5, word.style.size * 0.06),
      color: word.style.color,
      opacity: Math.min(block.opacity, word.style.alpha),
    });
  }
}

function alignOffset(align: TextBlock["align"], boxWidth: number, lineWidth: number): number {
  switch (align) {
    case "right":
      return Math.max(0, boxWidth - lineWidth);
    case "center":
      return Math.max(0, (boxWidth - lineWidth) / 2);
    default:
      return 0;
  }
}

/** Greedy word-wrap. Breaks over-long single words at the character level. */
function wrap(words: Word[], maxWidth: number, spaceWidth: number): Line[] {
  const lines: Line[] = [];
  let current: Word[] = [];
  let width = 0;

  const flush = () => {
    lines.push({ words: current, spaceWidth, width });
    current = [];
    width = 0;
  };

  for (const word of words) {
    if (word.text === "\n") {
      flush();
      continue;
    }
    const addWidth = (current.length ? spaceWidth : 0) + word.width;
    if (current.length && width + addWidth > maxWidth) {
      flush();
    }
    if (word.width > maxWidth && !current.length) {
      // Unbreakable word wider than the box: keep on its own line (no clipping
      // in PDF; overflow is preferable to silent truncation).
      lines.push({ words: [word], spaceWidth, width: word.width });
      continue;
    }
    current.push(word);
    width += (current.length > 1 ? spaceWidth : 0) + word.width;
  }
  if (current.length) flush();
  return lines.length ? lines : [{ words: [], spaceWidth, width: 0 }];
}
