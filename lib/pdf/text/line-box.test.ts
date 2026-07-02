/**
 * lineBoxHeight guards the "line jumps on commit" fix: a same-line-count edit
 * must return the ORIGINAL height bit-for-bit (any re-fit shows up as a nudge
 * on screen and a reflow push below), and wrapping grows by exact line steps.
 */
import { describe, expect, it } from "vitest";
import { lineBoxHeight, lineStep } from "./line-box";

describe("lineBoxHeight", () => {
  const fontSize = 12;
  const lineHeight = 1.2;
  const step = lineStep(fontSize, lineHeight); // 14.4

  it("keeps a single-line edit at the exact original height", () => {
    // Native ink boxes are shorter than a CSS line: 10.8 < 14.4.
    const h = lineBoxHeight({ measuredHeight: 14.4, originalHeight: 10.8, fontSize, lineHeight });
    expect(h).toBe(10.8);
  });

  it("never shrinks a box that is taller than its content", () => {
    // A user-drawn 100pt box with 2 lines of text stays 100pt.
    const h = lineBoxHeight({ measuredHeight: 2 * step, originalHeight: 100, fontSize, lineHeight });
    expect(h).toBe(100);
  });

  it("grows a single-line box by exactly one step when text wraps to two lines", () => {
    const h = lineBoxHeight({ measuredHeight: 2 * step, originalHeight: 10.8, fontSize, lineHeight });
    expect(h).toBeCloseTo(10.8 + step, 10);
  });

  it("grows a previously-grown box by further whole steps only", () => {
    const twoLines = 10.8 + step; // result of the previous growth
    const h = lineBoxHeight({ measuredHeight: 4 * step, originalHeight: twoLines, fontSize, lineHeight });
    expect(h).toBeCloseTo(twoLines + 2 * step, 10);
  });

  it("is robust to sub-pixel measurement noise around a line boundary", () => {
    // scrollHeight rounding can report 2 lines as 28 or 29 px — both are 2 lines.
    for (const measured of [2 * step - 0.9, 2 * step + 0.9]) {
      const h = lineBoxHeight({ measuredHeight: measured, originalHeight: 10.8, fontSize, lineHeight });
      expect(h).toBeCloseTo(10.8 + step, 10);
    }
  });

  it("falls back to a 1.2 multiplier for non-positive lineHeight", () => {
    const h = lineBoxHeight({ measuredHeight: 28.8, originalHeight: 10.8, fontSize, lineHeight: 0 });
    expect(h).toBeCloseTo(10.8 + 14.4, 10);
  });
});
