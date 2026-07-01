/**
 * Sub-word ("letter-by-letter") edit diffing.
 *
 * WHY THIS EXISTS: editing original PDF text used to whiteout + restamp an entire
 * visual line in a substitute Standard-14 font. That made two things wrong:
 *   1. Clicking grabbed the whole line, so editing never felt in-place.
 *   2. The whole line re-rendered in a heavier substitute font, so the edited
 *      text looked bolder than its untouched neighbours.
 *
 * The fix is to restamp ONLY the characters that actually changed. The editor now
 * opens per-word (per {@link TextSpan}); on commit we diff the word's old text
 * against the new text, find the changed middle, and produce a {@link SegmentEdit}
 * describing just that slice — its page-space x/width (from the original glyph
 * bounds), its replacement text/runs, and the baseline. Everything outside the
 * changed slice keeps its original embedded glyphs at 100% fidelity, so the font
 * mismatch is confined to exactly the letters the user typed.
 *
 * COORDINATES: all x/y/width are in PDF points, top-left origin (the editor model
 * space). Char→x mapping comes from the per-run `bounds` already captured during
 * extraction, so it matches the real glyph positions (never a re-layout).
 */
import type { TextRun } from "@/lib/pdf/editor/model/types";
import type { GlyphRun, TextStyle } from "./types";

export interface SegmentEdit {
  /** Char offset in the old word where the change starts (common-prefix length). */
  start: number;
  /** Char offset in the old word where the change ends, exclusive. */
  oldEnd: number;
  /** Replacement text for `[start, oldEnd)`. */
  text: string;
  /** Per-run styling for the replacement text. */
  runs: TextRun[];
  /** Page-space rect of the restamped slice (points, top-left origin). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Offset (pt) from `y` down to the text baseline, so the restamp sits on the
   *  original glyph baseline instead of a guessed ascent. */
  baseline: number;
}

/** The source word being edited: its text, the original glyph runs (for char→x),
 *  its union bounds and the line baseline (absolute, page space). */
export interface SegmentSource {
  text: string;
  runs: readonly GlyphRun[];
  bounds: { x: number; y: number; width: number; height: number };
  /** Absolute baseline y of the word's line (page space, top-left origin). */
  baseline: number;
  style: TextStyle;
}

/** Length of the common prefix of two strings. */
export function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** Length of the common suffix of two strings that does NOT overlap the first
 *  `prefix` characters already matched (so a pure insertion diffs cleanly). */
export function commonSuffixLen(a: string, b: string, prefix: number): number {
  const max = Math.min(a.length, b.length) - prefix;
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * Left-edge x (pt) of every character in `text`, plus a final sentinel at the
 * right edge. Within a multi-character glyph run the width is split evenly by
 * character count (good enough for a cut point; exact at run boundaries). Any
 * trailing characters not covered by a run (e.g. a reconstructed word space) are
 * pinned to the last run's right edge.
 */
export function charXPositions(runs: readonly GlyphRun[], text: string): number[] {
  const xs: number[] = [];
  let lastRight = runs.length ? runs[0].bounds.x : 0;
  for (const run of runs) {
    const n = Math.max(1, run.text.length);
    const w = run.bounds.width / n;
    for (let i = 0; i < run.text.length; i++) xs.push(run.bounds.x + i * w);
    lastRight = run.bounds.x + run.bounds.width;
  }
  while (xs.length < text.length) xs.push(lastRight);
  xs.push(lastRight);
  return xs;
}

/** Slice styled runs to the character range `[start, end)`, preserving each
 *  run's styling. Used to carry the edited slice's formatting onto the restamp. */
export function sliceRuns(runs: readonly TextRun[], start: number, end: number): TextRun[] {
  if (end <= start) return [];
  const out: TextRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const len = run.text.length;
    const s = Math.max(start, pos);
    const e = Math.min(end, pos + len);
    if (s < e) out.push({ ...run, text: run.text.slice(s - pos, e - pos) });
    pos += len;
    if (pos >= end) break;
  }
  return out;
}

const WIDTH_EPS = 1.0; // pt tolerance before we reflow a word's tail

/**
 * Diff a word's old text against the new text and describe just the changed
 * slice to restamp. Returns `null` when nothing changed (so the caller can keep
 * the original glyphs untouched, e.g. a pure box move).
 *
 * When the new slice is no wider than the original (typo fixes, deletions,
 * equal-length swaps) the trailing unchanged characters are preserved as original
 * glyphs. When it would be wider (an insertion), the slice is extended to the end
 * of the word so the tail reflows in the restamp instead of being overlapped.
 */
export function computeSegmentEdit(args: {
  source: SegmentSource;
  newText: string;
  newRuns: TextRun[];
  /** Width (pt) of a string in the restamp font; omit in non-DOM contexts. */
  measureWidth?: (text: string) => number;
}): SegmentEdit | null {
  const { source, newText, newRuns } = args;
  const oldText = source.text;
  if (oldText === newText) return null;

  const xs = charXPositions(source.runs, oldText);
  const xAt = (i: number) => xs[Math.min(Math.max(i, 0), xs.length - 1)];

  const p = commonPrefixLen(oldText, newText);
  const s = commonSuffixLen(oldText, newText, p);
  const start = p;
  let oldEnd = oldText.length - s;
  let newEnd = newText.length - s;

  const oldWidth = Math.max(0, xAt(oldEnd) - xAt(start));
  const newSlice = newText.slice(start, newEnd);
  const newWidth = args.measureWidth ? args.measureWidth(newSlice) : estimateWidth(newSlice, oldText, oldWidth);

  // If the replacement would be wider than the gap it fills, the preserved tail
  // would be overlapped — extend the slice to the word's end so it reflows.
  if (s > 0 && newWidth > oldWidth + WIDTH_EPS) {
    oldEnd = oldText.length;
    newEnd = newText.length;
  }

  const text = newText.slice(start, newEnd);
  const runs = sliceRuns(newRuns.length ? newRuns : [{ text: newText }], start, newEnd);
  const x = xAt(start);
  const right = xAt(oldEnd);
  const width = Math.max(oldEnd > start ? right - x : 0, args.measureWidth ? args.measureWidth(text) : 0, 1);
  const y = source.bounds.y;
  const baseline = Math.max(0, source.baseline - y);
  return { start, oldEnd, text, runs, x, y, width, height: source.bounds.height, baseline };
}

/** Rough width estimate from the original word's average char width, used only
 *  when no DOM measurer is available (tests/SSR). */
function estimateWidth(text: string, oldText: string, oldWidth: number): number {
  const per = oldText.length ? oldWidth / oldText.length : 0;
  return text.length * per;
}
