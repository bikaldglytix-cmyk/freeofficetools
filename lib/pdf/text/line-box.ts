/**
 * Pure line-box arithmetic for text-edit commits — the fix for the "line jumps
 * when I commit an edit" glitch.
 *
 * The old commit path set the box height to the CSS-measured `scrollHeight`
 * whenever the text wrapped. The CSS one-line height (fontSize × lineHeight) is
 * a touch taller than the extracted ink box of a native PDF line, so that
 * assignment nudged the box — and, via reflow, everything below it — by the
 * sub-point difference. This module instead grows the box by EXACT line steps
 * from its original height: the first line never moves, and content below is
 * pushed by precisely the space the added lines occupy (the same
 * fontSize × lineHeight leading the export engine lays lines out with).
 */

export interface LineBoxInput {
  /** CSS-measured height of the edited text (from `measureTextBoxHeight`). */
  measuredHeight: number;
  /** The box height before this edit (extracted ink box or prior commit). */
  originalHeight: number;
  /** Effective font size in points (largest run in the block). */
  fontSize: number;
  /** Unitless line-height multiplier; non-positive falls back to 1.2. */
  lineHeight: number;
}

/** The vertical distance between consecutive baselines, in points. */
export function lineStep(fontSize: number, lineHeight: number): number {
  return fontSize * (lineHeight > 0 ? lineHeight : 1.2);
}

/**
 * The committed box height: unchanged while the text still fits the lines the
 * box already had (never a sub-point re-fit, never a shrink — both read as
 * "jumps"), grown by whole line steps when the text wraps to more lines.
 */
export function lineBoxHeight(input: LineBoxInput): number {
  const step = lineStep(input.fontSize, input.lineHeight);
  if (step <= 0) return input.originalHeight;
  const lines = Math.max(1, Math.round(input.measuredHeight / step));
  // How many lines the box already accommodates. A native single-line ink box
  // is SHORTER than one CSS line step — round, don't floor, so it counts as 1.
  const baseLines = Math.max(1, Math.round(input.originalHeight / step));
  if (lines <= baseLines) return input.originalHeight;
  return input.originalHeight + (lines - baseLines) * step;
}
