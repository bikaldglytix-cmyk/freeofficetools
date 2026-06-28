/**
 * Measure how tall a text box must be to show all of its text without clipping.
 *
 * This is the single source of truth for the editor's "auto-grow" behaviour
 * (matching Acrobat: a text box grows downward to fit its content instead of
 * hiding the overflow). Both the content-edit and style-change paths call this
 * so the on-screen box, the selection handles and the exported geometry always
 * agree.
 *
 * COORDINATES: everything is in **PDF points**. The viewer paints text at
 * `fontSize * zoom` px inside a `width * zoom` px box, so wrapping is
 * scale-invariant; we therefore measure at 1pt == 1px (zoom 1) and the
 * resulting height is already in points. A hidden DOM element reproduces the
 * exact CSS the editor uses (`pre-wrap` + `break-word`) so the measured line
 * count matches what the user sees. In non-DOM contexts (SSR, the Node test
 * runner) we fall back to a hard-line-break estimate.
 */
export interface MeasureTextInput {
  text: string;
  /** Box width in points (text wraps to this). */
  widthPoints: number;
  fontFamily: string;
  fontSizePoints: number;
  bold?: boolean;
  italic?: boolean;
  /** Unitless line-height multiplier (e.g. 1.2). */
  lineHeight: number;
}

let measureEl: HTMLDivElement | null = null;

function getMeasureEl(): HTMLDivElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (!measureEl) {
    measureEl = document.createElement("div");
    const s = measureEl.style;
    s.position = "absolute";
    s.left = "-9999px";
    s.top = "0";
    s.visibility = "hidden";
    s.boxSizing = "content-box";
    s.whiteSpace = "pre-wrap";
    s.wordBreak = "break-word";
    s.overflowWrap = "break-word";
    s.padding = "0";
    s.margin = "0";
    s.border = "0";
    measureEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(measureEl);
  }
  return measureEl;
}

export function measureTextBoxHeight(input: MeasureTextInput): number {
  const lineHeight = input.lineHeight > 0 ? input.lineHeight : 1.2;
  const oneLine = input.fontSizePoints * lineHeight;

  const el = getMeasureEl();
  if (!el) {
    // No DOM available: approximate by hard line breaks only (no wrap).
    const lines = (input.text || " ").split("\n").length;
    return Math.max(oneLine, lines * oneLine);
  }

  const s = el.style;
  s.width = `${Math.max(1, input.widthPoints)}px`;
  s.fontFamily = input.fontFamily;
  s.fontSize = `${input.fontSizePoints}px`;
  s.fontWeight = input.bold ? "700" : "400";
  s.fontStyle = input.italic ? "italic" : "normal";
  s.lineHeight = String(lineHeight);
  // Trailing "​" (zero-width space) forces a final empty line produced by a
  // trailing newline to be counted in scrollHeight; a lone space keeps an empty
  // box one line tall instead of collapsing to zero.
  el.textContent = input.text && input.text.length ? `${input.text}​` : " ";

  return Math.max(oneLine, el.scrollHeight);
}

// ---------------------------------------------------------------------------
// Caret hit-testing — turn a click into a character offset
// ---------------------------------------------------------------------------

let caretCanvas: HTMLCanvasElement | null = null;

function caretContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!caretCanvas) caretCanvas = document.createElement("canvas");
  return caretCanvas.getContext("2d");
}

export interface CaretQuery {
  text: string;
  /** Click x relative to the text's left edge, in the same px scale as fontSizePx. */
  xPx: number;
  /** Font size at display scale (i.e. points * zoom). */
  fontSizePx: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * The character offset nearest a click, so opening the editor drops the caret
 * exactly where the user clicked instead of selecting the whole line. Measures
 * cumulative glyph widths on a canvas with the editor's font; the half-glyph
 * midpoint test picks the closer side of each character (standard caret rule).
 */
export function caretIndexAtX(q: CaretQuery): number {
  if (q.xPx <= 0 || !q.text) return 0;
  const ctx = caretContext();
  if (!ctx) return q.text.length;
  ctx.font = `${q.italic ? "italic " : ""}${q.bold ? "700 " : "400 "}${q.fontSizePx}px ${q.fontFamily}`;
  let acc = 0;
  for (let i = 0; i < q.text.length; i++) {
    const w = ctx.measureText(q.text[i]).width;
    if (acc + w / 2 >= q.xPx) return i;
    acc += w;
  }
  return q.text.length;
}
