import { describe, expect, it } from "vitest";
import { computeRemovals, regionFromVisualRect, type RemovalRegion } from "./content-redactor";

/** Apply edits the same way the module does, for assertion convenience. */
function apply(src: string, edits: ReturnType<typeof computeRemovals>): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const e of sorted) {
    out += src.slice(pos, e.start) + e.replacement;
    pos = e.end;
  }
  return out + src.slice(pos);
}

const around = (x: number, y: number): RemovalRegion => ({ x0: x - 30, x1: x + 30, y0: y - 6, y1: y + 6 });

describe("computeRemovals", () => {
  it("blanks only the show operator whose origin is inside a region", () => {
    const src = [
      "BT /F1 12 Tf 1 0 0 1 100 700 Tm (Hello) Tj ET",
      "BT /F1 12 Tf 1 0 0 1 100 600 Tm [(World)] TJ ET",
    ].join("\n");

    const edits = computeRemovals(src, [around(100, 700)]);
    expect(edits).toHaveLength(1);
    expect(src.slice(edits[0].start, edits[0].end)).toBe("(Hello)");
    expect(edits[0].replacement).toBe("()");

    const out = apply(src, edits);
    expect(out).toContain("() Tj");
    expect(out).toContain("[(World)] TJ"); // untouched
    expect(out).not.toContain("(Hello)");
  });

  it("handles TJ arrays and hex strings", () => {
    const src = "BT 1 0 0 1 50 500 Tm [(a)-10(b)] TJ ET BT 1 0 0 1 50 480 Tm <48656c6c6f> Tj ET";
    const all = computeRemovals(src, [around(50, 500), around(50, 480)]);
    expect(all).toHaveLength(2);
    const out = apply(src, all);
    expect(out).toContain("[] TJ");
    expect(out).toContain("<> Tj");
  });

  it("respects the CTM when computing the origin", () => {
    // cm scales by 2, so a Tm at (50,100) renders at (100,200).
    const src = "q 2 0 0 2 0 0 cm BT 1 0 0 1 50 100 Tm (Big) Tj ET Q";
    expect(computeRemovals(src, [around(100, 200)])).toHaveLength(1); // device-space hit
    expect(computeRemovals(src, [around(50, 100)])).toHaveLength(0); // text-space miss
  });

  it("follows T* line advances", () => {
    const src = "BT 12 TL 1 0 0 1 80 400 Tm (line1) Tj T* (line2) Tj ET";
    // line1 at y=400, line2 advanced down by leading 12 → y=388
    const out = apply(src, computeRemovals(src, [around(80, 388)]));
    expect(out).toContain("(line1) Tj"); // first line kept
    expect(out).toContain("() Tj"); // second line blanked
  });

  it("returns no edits when nothing falls in a region", () => {
    const src = "BT 1 0 0 1 100 700 Tm (Hello) Tj ET";
    expect(computeRemovals(src, [around(400, 100)])).toHaveLength(0);
  });
});

describe("regionFromVisualRect", () => {
  it("flips the y axis from top-left visual space to PDF user space", () => {
    const r = regionFromVisualRect({ x: 10, y: 20, width: 100, height: 12 }, 800);
    expect(r).toEqual({ x0: 10, x1: 110, y0: 768, y1: 780 });
  });
});
