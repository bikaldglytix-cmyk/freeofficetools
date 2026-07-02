/**
 * Native-text reflow: when an edited line grows (wraps to more lines), the
 * ORIGINAL page text below it must move down too — not just store objects.
 *
 * Native text is baked into the page raster, so it can't be "moved"; instead
 * each affected line is PROMOTED into the content model: a replacement text
 * object stamped `delta` lower, whose whiteout + content-stream redaction
 * erase the original glyphs at the source (exactly what editing the line by
 * hand would do). Promotion is visually seamless because the export engine
 * embeds the same metric-compatible faces the screen shows (Phase 1); this is
 * the Acrobat behaviour: the whole column shifts, nothing overlaps.
 *
 * Pure — takes the page's still-native lines and returns operations, so the
 * caller batches them with the edit into ONE undoable action.
 */
import { REFLOW_TOLERANCE } from "@/lib/pdf/editor/model/reflow";
import type { EditOperation } from "@/lib/pdf/editor/operations/types";
import { createReplacementTextOperation } from "./operations";
import { runsFromSpans } from "./rich-runs";
import type { TextBlock } from "./types";

export interface NativeReflowParams {
  /** The page's single-line native blocks still in the raster (already
   *  excludes lines a store object has replaced). */
  lines: readonly TextBlock[];
  /** The line being edited in this same batch — never promote it twice. */
  excludeId?: string;
  /** The grown block's bottom edge BEFORE it grew (y + height). */
  oldBottom: number;
  /** How much taller it became (newHeight - oldHeight). */
  delta: number;
}

/**
 * Promote every native line whose top sits at or below `oldBottom` into a
 * replacement object `delta` lower. Empty when the block didn't really grow.
 */
export function reflowNativeBelowOps(params: NativeReflowParams): EditOperation[] {
  const { lines, excludeId, oldBottom, delta } = params;
  if (delta <= REFLOW_TOLERANCE) return [];
  const out: EditOperation[] = [];
  for (const line of lines) {
    if (line.id === excludeId) continue;
    if (line.bounds.y < oldBottom - REFLOW_TOLERANCE) continue;
    out.push(
      createReplacementTextOperation({
        source: line,
        text: line.text,
        runs: runsFromSpans(line.lines[0]?.spans ?? []),
        rect: { ...line.bounds, y: line.bounds.y + delta },
      }),
    );
  }
  return out;
}
