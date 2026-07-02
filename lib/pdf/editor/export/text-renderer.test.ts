/**
 * TextRenderer rich-run fidelity tests. These guard the trust-critical bug:
 * a line with mixed formatting (only one word bold) must export with each run's
 * own weight, and runs that split *inside* a word must be drawn touching — never
 * separated by a phantom word space.
 *
 * Runs in Node with a stub RenderContext (no pdf-lib document needed): we capture
 * every `drawText` call and assert the fragment positions and resolved fonts.
 */
import { describe, expect, it } from "vitest";
import { createTextBlock } from "../model/factory";
import type { TextRun } from "../model/types";
import { placementFor } from "./geometry";
import { TextRenderer } from "./text-renderer";
import type { RenderContext } from "./pdf-writer";

interface DrawCall {
  text: string;
  x: number;
  y: number;
  size: number;
  font: { family: string; bold: boolean; italic: boolean };
}

function stubContext(): { ctx: RenderContext; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const resolveFont = ({ family, bold, italic }: { family: string; bold?: boolean; italic?: boolean }) => ({
    font: { family, bold: Boolean(bold), italic: Boolean(italic) },
    fallback: false,
  });
  const fonts = {
    sanitizeForStandard: (t: string) => t,
    // Width depends only on length + size, so spacing assertions are exact.
    widthOf: (_font: unknown, text: string, size: number) => text.length * size * 0.5,
    resolveFont,
    // Coverage routing is a no-op in the stub: the primary face covers all.
    resolveFontForText: (req: { family: string; bold?: boolean; italic?: boolean }) => resolveFont(req),
  };
  const page = {
    drawText: (text: string, opts: { x: number; y: number; size: number; font: DrawCall["font"] }) =>
      calls.push({ text, x: opts.x, y: opts.y, size: opts.size, font: opts.font }),
    drawLine: () => {},
  };
  const ctx = {
    page,
    pageId: "p",
    placement: placementFor({ width: 612, height: 792 }, 0),
    fonts,
  } as unknown as RenderContext;
  return { ctx, calls };
}

const baseRun = (text: string, over: Partial<TextRun> = {}): TextRun => ({
  text,
  fontFamily: "Arial",
  fontSize: 12,
  color: "#000000",
  bold: false,
  italic: false,
  ...over,
});

describe("TextRenderer — per-run formatting", () => {
  it("keeps only the bold run bold and never inserts a space inside a word", () => {
    // "keywords:" = bold "keyword" + plain "s:"; then plain " one two".
    const block = createTextBlock({
      pageId: "p",
      rect: { x: 50, y: 50, width: 400, height: 20 },
      text: "keywords: one two",
      fontFamily: "Arial",
      fontSize: 12,
      runs: [baseRun("keyword", { bold: true }), baseRun("s: "), baseRun("one two")],
    });

    const { ctx, calls } = stubContext();
    new TextRenderer().draw(ctx, block);

    const texts = calls.map((c) => c.text);
    expect(texts).toEqual(["keyword", "s:", "one", "two"]);

    // Only the first fragment is bold; the rest inherit the plain run style.
    expect(calls[0].font.bold).toBe(true);
    expect(calls[1].font.bold).toBe(false);
    expect(calls[2].font.bold).toBe(false);
    expect(calls[3].font.bold).toBe(false);

    // "s:" starts exactly where "keyword" ends (width 7*12*0.5 = 42) — no phantom
    // space between two runs of the same word.
    expect(calls[1].x - calls[0].x).toBeCloseTo(42, 5);

    // "one" is separated from "s:" by exactly one word space (width 2*12*0.5 = 12,
    // plus space 1*12*0.5 = 6 → 18).
    expect(calls[2].x - calls[1].x).toBeCloseTo(18, 5);
  });

  it("falls back to the block style when there are no runs", () => {
    const block = createTextBlock({
      pageId: "p",
      rect: { x: 0, y: 0, width: 400, height: 20 },
      text: "hello world",
      fontFamily: "Arial",
      fontSize: 10,
      bold: true,
    });
    const { ctx, calls } = stubContext();
    new TextRenderer().draw(ctx, block);
    expect(calls.map((c) => c.text)).toEqual(["hello", "world"]);
    expect(calls.every((c) => c.font.bold)).toBe(true);
  });

  it("honours per-run font size so a larger run renders larger", () => {
    const block = createTextBlock({
      pageId: "p",
      rect: { x: 0, y: 0, width: 400, height: 40 },
      text: "small BIG",
      fontFamily: "Arial",
      fontSize: 10,
      runs: [baseRun("small ", { fontSize: 10 }), baseRun("BIG", { fontSize: 24 })],
    });
    const { ctx, calls } = stubContext();
    new TextRenderer().draw(ctx, block);
    const big = calls.find((c) => c.text === "BIG");
    expect(big?.size).toBe(24);
  });
});
