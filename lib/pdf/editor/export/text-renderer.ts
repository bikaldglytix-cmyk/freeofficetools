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
import type { FontRequest } from "./fonts";
import { placeBaseline, mapPoint } from "./geometry";
import type { RenderContext } from "./pdf-writer";

interface StyleResolved {
  font: PDFFont;
  size: number;
  color: RGB;
  alpha: number;
  underline: boolean;
  /** The font request, so per-fragment coverage routing can pick a face that
   *  actually has the glyphs (e.g. a Unicode fallback for non-Latin text). */
  req: FontRequest;
  /** True when this resolved to a standard font (needs WinAnsi sanitizing). */
  standard: boolean;
}

/** A contiguous run of glyphs sharing one resolved style. A single "word" may
 *  hold several fragments when runs split inside it (e.g. bold "keywords" + plain
 *  ":") — they must be drawn touching, never separated by a word space. */
interface Fragment {
  text: string;
  style: StyleResolved;
  width: number;
}

interface Word {
  frags: Fragment[];
  width: number;
}

/** Token stream produced by {@link tokenize}: words, single spaces and breaks. */
type Token = { kind: "word"; word: Word } | { kind: "space" } | { kind: "break" };

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
    const tokens = this.tokenize(ctx, block);
    if (tokens.length === 0) return;

    const lineStep = block.fontSize * (block.lineHeight || 1.2);
    // Place the first baseline where the ORIGINAL glyphs sat when we captured it
    // (edited native text), so the restamp doesn't drift up/down; otherwise fall
    // back to a good standard-font ascent approximation.
    const firstBaseline =
      typeof block.metadata?.firstBaseline === "number" ? (block.metadata.firstBaseline as number) : block.fontSize * 0.8;
    // noWrap blocks (single-line native edits) never re-wrap to the rect: the
    // text continues on the same line past the right edge, Acrobat-style.
    const maxWidth = block.noWrap ? Number.POSITIVE_INFINITY : block.rect.width;
    const lines = wrap(tokens, maxWidth, this.spaceWidthFor(ctx, block));

    const pivot = mapPoint(block.rect.x, block.rect.y, ctx.placement);

    lines.forEach((line, i) => {
      const baselineY = block.rect.y + firstBaseline + i * lineStep;
      const isLast = i === lines.length - 1;
      let cursorX = block.rect.x + alignOffset(block.align, block.rect.width, line.width, Boolean(block.noWrap));
      const justify = block.align === "justify" && !isLast && line.words.length > 1;
      const gap = justify
        ? line.spaceWidth + (block.rect.width - line.width) / (line.words.length - 1)
        : line.spaceWidth;

      line.words.forEach((word, wi) => {
        // Fragments of a word are drawn touching (no word space between them) so
        // a run boundary inside a word doesn't introduce a phantom gap.
        for (const frag of word.frags) {
          const placed = placeBaseline({ x: cursorX, y: baselineY }, pivot, ctx.placement, block.rotation);
          ctx.page.drawText(frag.text, {
            x: placed.x,
            y: placed.y,
            size: frag.style.size,
            font: frag.style.font,
            color: frag.style.color,
            opacity: Math.min(block.opacity, frag.style.alpha),
            rotate: degrees(placed.rotateDeg),
          });
          if (frag.style.underline) {
            this.underline(ctx, cursorX, baselineY, frag, pivot, block);
          }
          cursorX += frag.width;
        }
        if (wi < line.words.length - 1) cursorX += gap;
      });
    });
  }

  /**
   * Split block text (or runs) into a token stream of words, single spaces and
   * hard breaks. A word collects every contiguous non-whitespace fragment, even
   * across run boundaries, so styling that changes mid-word (e.g. "keyword**s**")
   * stays a single, unspaced word with multiple styled fragments.
   */
  private tokenize(ctx: RenderContext, block: TextBlock): Token[] {
    const segments: { text: string; run?: TextRun }[] =
      block.runs && block.runs.length
        ? block.runs.map((r) => ({ text: r.text, run: r }))
        : [{ text: block.text }];

    const tokens: Token[] = [];
    let frags: Fragment[] = [];
    let wordWidth = 0;
    const flushWord = () => {
      if (frags.length) {
        tokens.push({ kind: "word", word: { frags, width: wordWidth } });
        frags = [];
        wordWidth = 0;
      }
    };

    for (const seg of segments) {
      const style = this.resolveStyle(ctx, block, seg.run);
      for (const part of seg.text.split(/(\n)/)) {
        if (part === "\n") {
          flushWord();
          tokens.push({ kind: "break" });
          continue;
        }
        // Split into alternating word / whitespace chunks; runs of whitespace
        // collapse to one word space, matching the previous renderer's spacing.
        for (const chunk of part.split(/(\s+)/)) {
          if (!chunk) continue;
          if (/^\s+$/.test(chunk)) {
            flushWord();
            tokens.push({ kind: "space" });
            continue;
          }
          // Coverage routing: pick the face that actually has this chunk's
          // glyphs (primary → Unicode fallback), so mixed-script text doesn't
          // silently lose characters. Only the standard-font fallback path
          // still needs WinAnsi sanitizing.
          const resolved = ctx.fonts.resolveFontForText(style.req, chunk);
          const fragStyle: StyleResolved =
            resolved.font === style.font
              ? style
              : { ...style, font: resolved.font, standard: resolved.fallback };
          const text = fragStyle.standard
            ? ctx.fonts.sanitizeForStandard(chunk, { pageId: ctx.pageId, objectId: block.id })
            : chunk;
          const width = ctx.fonts.widthOf(fragStyle.font, text, fragStyle.size);
          frags.push({ text, style: fragStyle, width });
          wordWidth += width;
        }
      }
    }
    flushWord();
    return tokens;
  }

  private resolveStyle(ctx: RenderContext, block: TextBlock, run?: TextRun): StyleResolved {
    const family = run?.fontFamily ?? block.fontFamily;
    const bold = run?.bold ?? block.bold ?? /bold|black|heavy|semibold|demi/i.test(family);
    const italic = run?.italic ?? block.italic ?? /italic|oblique/i.test(family);
    const req: FontRequest = { family, bold, italic };
    const resolved = ctx.fonts.resolveFont(req);
    const { rgb: color, alpha } = parseColor(run?.color ?? block.color);
    return {
      font: resolved.font,
      size: run?.fontSize ?? block.fontSize,
      color,
      alpha,
      underline: run?.underline ?? false,
      req,
      standard: resolved.fallback,
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
    frag: Fragment,
    pivot: { x: number; y: number },
    block: TextBlock,
  ): void {
    const y = baselineY + frag.style.size * 0.12;
    const a = placeBaseline({ x: startX, y }, pivot, ctx.placement, block.rotation);
    const b = placeBaseline({ x: startX + frag.width, y }, pivot, ctx.placement, block.rotation);
    ctx.page.drawLine({
      start: { x: a.x, y: a.y },
      end: { x: b.x, y: b.y },
      thickness: Math.max(0.5, frag.style.size * 0.06),
      color: frag.style.color,
      opacity: Math.min(block.opacity, frag.style.alpha),
    });
  }
}

function alignOffset(align: TextBlock["align"], boxWidth: number, lineWidth: number, allowOverflow = false): number {
  switch (align) {
    case "right":
      // Overflowing noWrap lines keep their RIGHT edge pinned (grow leftward);
      // wrapped blocks clamp so an unbreakable word can't drift out of the box.
      return allowOverflow ? boxWidth - lineWidth : Math.max(0, boxWidth - lineWidth);
    case "center":
      return allowOverflow ? (boxWidth - lineWidth) / 2 : Math.max(0, (boxWidth - lineWidth) / 2);
    default:
      return 0;
  }
}

/**
 * Greedy word-wrap over the token stream. Consecutive words are separated by one
 * `spaceWidth`; `break` tokens force a new line; over-long single words overflow
 * onto their own line rather than being clipped. `space` tokens between words are
 * implicit (a word is only ever flushed at a space or break), so they don't need
 * to be re-counted here.
 */
function wrap(tokens: Token[], maxWidth: number, spaceWidth: number): Line[] {
  const lines: Line[] = [];
  let current: Word[] = [];
  let width = 0;

  const flush = () => {
    lines.push({ words: current, spaceWidth, width });
    current = [];
    width = 0;
  };

  for (const token of tokens) {
    if (token.kind === "break") {
      flush();
      continue;
    }
    if (token.kind === "space") continue; // separator only; see wrap doc comment
    const word = token.word;
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
