import { describe, expect, it } from "vitest";
import { computeRemovals, regionFromVisualRect, removeTextInRegions, type RemovalRegion } from "./content-redactor";

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

  it("reports per-region matches so unreachable regions keep their masks", () => {
    const src = "BT 1 0 0 1 100 700 Tm (Hello) Tj ET";
    const matched = [false, false];
    const edits = computeRemovals(src, [around(100, 700), around(400, 100)], matched);
    expect(edits).toHaveLength(1);
    expect(matched).toEqual([true, false]);
  });

  it("never blanks the single-spaced line ABOVE the edited line", () => {
    // Two 12pt lines at very tight leading (12pt apart). The edited (lower)
    // line's mask region is its ink extent: ~descent+halo below the baseline,
    // a full ascent above — which vertically OVERLAPS the line above. Origins
    // are baselines, so only the bottom band of the region may match.
    const src = [
      "BT 1 0 0 1 100 712 Tm (above) Tj ET",
      "BT 1 0 0 1 100 700 Tm (edited) Tj ET",
      "BT 1 0 0 1 100 688 Tm (below) Tj ET",
    ].join("\n");
    // Region for the edited line (baseline 700): bottom = 700 − 3.2, top = 700 + 11.
    const region: RemovalRegion = { x0: 90, x1: 200, y0: 696.8, y1: 711 };
    const matched = [false];
    const edits = computeRemovals(src, [region], matched);
    expect(edits).toHaveLength(1);
    const out = apply(src, edits);
    expect(out).toContain("(above) Tj");
    expect(out).toContain("(below) Tj");
    expect(out).not.toContain("(edited)");
    expect(matched).toEqual([true]);
  });
});

describe("regionFromVisualRect", () => {
  it("flips the y axis from top-left visual space to PDF user space", () => {
    const r = regionFromVisualRect({ x: 10, y: 20, width: 100, height: 12 }, 800);
    expect(r).toEqual({ x0: 10, x1: 110, y0: 768, y1: 780 });
  });
});

describe("removeTextInRegions — page box origin", () => {
  it("matches text on pages whose MediaBox origin is not (0,0)", async () => {
    // Word/Skia exports often use an offset MediaBox (e.g. y₀ = 8.37). Editor
    // rects are relative to the RENDERED box, content-stream origins are raw
    // device coordinates — without the shift nothing ever matched on such PDFs.
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage([445.5, 639.12]);
    page.setMediaBox(0, 8.37, 445.5, 630.75);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("target", { x: 100, y: 400, size: 12, font }); // device baseline y=400
    page.drawText("above", { x: 100, y: 412, size: 12, font }); // tight line above

    // Round-trip so the page content becomes a raw stream, like a real
    // loaded/copied source page (the only shape the redactor operates on).
    const reloaded = await PDFDocument.load(await doc.save());

    // The editor's visual-space ink rect for the target line: box-relative,
    // top-left origin. Baseline visual y = (8.37 + 630.75) − 400 = 239.12.
    const rect = { x: 90, y: 239.12 - 10, width: 100, height: 13.5 };
    const result = removeTextInRegions(reloaded.getPage(0), [regionFromVisualRect(rect, 630.75)]);
    expect(result.ok).toBe(true);
    expect(result.matched).toEqual([true]);
    // Exactly ONE op blanked: the target, never its tight neighbour above.
    expect(result.removed).toBe(1);
  });
});
