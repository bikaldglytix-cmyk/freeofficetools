/**
 * reflowNativeBelowOps guards the Acrobat-style behaviour: when an edited line
 * wraps and grows, the ORIGINAL page lines below it are promoted into shifted
 * replacement objects (whiteout at the source + restamp lower) so the grown
 * text never overlaps them.
 */
import { describe, expect, it } from "vitest";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { defaultTextStyle } from "./fonts";
import { reflowNativeBelowOps } from "./reflow-native";
import type { TextBlock, TextLine } from "./types";

function nativeLine(id: string, bounds: Rect, text = `line ${id}`): TextBlock {
  const line: TextLine = {
    id: `${id}_l0`,
    text,
    bounds,
    spans: [],
    baseline: bounds.y + bounds.height * 0.8,
    direction: "ltr",
  };
  return {
    id,
    documentId: "doc",
    pageId: "p1",
    text,
    bounds,
    lines: [line],
    style: defaultTextStyle(),
    transforms: { rotation: 0, matrix: [1, 0, 0, 1, 0, 0] },
    opacity: 1,
    zIndex: 0,
    provenance: { kind: "native", pdfItemIds: [`item_${id}`], confidence: 1, editable: "overlay-replacement" },
    createdAt: 0,
    updatedAt: 0,
    metadata: {},
  };
}

const edited = nativeLine("edited", { x: 50, y: 100, width: 300, height: 12 });
const below1 = nativeLine("below1", { x: 50, y: 120, width: 300, height: 12 });
const below2 = nativeLine("below2", { x: 50, y: 140, width: 300, height: 12 });
const above = nativeLine("above", { x: 50, y: 60, width: 300, height: 12 });

describe("reflowNativeBelowOps", () => {
  const oldBottom = edited.bounds.y + edited.bounds.height; // 112

  it("promotes every native line below the grown block, shifted by delta", () => {
    const ops = reflowNativeBelowOps({
      lines: [edited, above, below1, below2],
      excludeId: edited.id,
      oldBottom,
      delta: 14.4,
    });
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.type).toBe("ADD_TEXT");
    const rects = ops.map((op) => (op.type === "ADD_TEXT" ? op.object.rect : null));
    expect(rects[0]).toMatchObject({ x: 50, y: 120 + 14.4 });
    expect(rects[1]).toMatchObject({ x: 50, y: 140 + 14.4 });
  });

  it("masks the ORIGINAL position while restamping at the shifted one", () => {
    const [op] = reflowNativeBelowOps({ lines: [below1], oldBottom, delta: 14.4 });
    if (op.type !== "ADD_TEXT") throw new Error("expected ADD_TEXT");
    const exp = op.object.metadata?.export as { whiteout?: { bounds: Rect[] }; bounds?: Rect };
    // Whiteout erases the glyphs where they originally were…
    expect(exp.whiteout?.bounds[0]?.y).toBeLessThanOrEqual(120);
    // …and the restamp bounds sit delta lower.
    expect(exp.bounds?.y).toBeCloseTo(120 + 14.4, 5);
    // The native line is linked so the editor hides it once replaced.
    expect(op.object.originalItemIds).toEqual(["item_below1"]);
  });

  it("leaves lines above the edit and the edited line itself alone", () => {
    const ops = reflowNativeBelowOps({
      lines: [edited, above],
      excludeId: edited.id,
      oldBottom,
      delta: 14.4,
    });
    expect(ops).toHaveLength(0);
  });

  it("does nothing for sub-tolerance growth", () => {
    const ops = reflowNativeBelowOps({ lines: [below1, below2], oldBottom, delta: 0.4 });
    expect(ops).toHaveLength(0);
  });
});
