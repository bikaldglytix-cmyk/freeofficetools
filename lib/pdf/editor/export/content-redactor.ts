/**
 * ContentRedactor — TRUE removal of original text from a copied page.
 *
 * The whiteout/restamp path (OverlayRenderer) only PAINTS OVER original glyphs;
 * the text stays in the content stream and is still selectable/searchable. This
 * module instead rewrites the page's content stream and blanks the text-showing
 * operators (`Tj`/`TJ`/`'`/`"`) whose rendering origin falls inside an edited
 * region, so the original words are genuinely gone from the file.
 *
 * How it stays safe:
 *  - It is purely additive to the pipeline: any failure (decode error, parse
 *    surprise, rotated page, text living inside a form XObject) returns
 *    `ok:false` and leaves the page byte-for-byte unchanged, so the whiteout
 *    mask still guarantees the visual result. It never throws.
 *  - It only blanks the *string operand* of a show operator (e.g. `(x) Tj` →
 *    `() Tj`, `[..] TJ` → `[] TJ`), preserving every positioning/state operator
 *    so the rest of the page renders identically.
 *  - It only touches operators whose origin is inside a caller-supplied region
 *    (the original bounds of blocks the user actually edited).
 *
 * KNOWN LIMITS: text drawn inside form XObjects (`/Fm Do`) isn't in the page
 * content stream, so it can't be reached here (whiteout still covers it). Pages
 * with a non-zero /Rotate are skipped (region mapping would need the rotation).
 */
import { PDFArray, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { Rect } from "../model/types";

/** A rectangle in PDF user space (origin bottom-left, y up). */
export interface RemovalRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RedactionResult {
  ok: boolean;
  /** Number of text-show operators blanked. */
  removed: number;
  reason?: string;
  /** Per input region: whether at least one show operator was blanked inside it.
   *  A region that never matched (e.g. its text lives in a form XObject) still
   *  needs a visual mask. Same order as the input `regions`. */
  matched?: boolean[];
}

/** A small tolerance (pt) around a region so baselines just inside still match. */
const PAD = 2;

/**
 * Convert an editor/visual-space rect (origin top-left, y down) to a PDF
 * user-space {@link RemovalRegion}. Only valid for an unrotated page.
 */
export function regionFromVisualRect(rect: Rect, pageHeight: number): RemovalRegion {
  return {
    x0: rect.x,
    x1: rect.x + rect.width,
    y0: pageHeight - (rect.y + rect.height),
    y1: pageHeight - rect.y,
  };
}

/**
 * Blank every text-show operator on `page` whose origin falls within any region.
 * Returns `ok:false` (and leaves the page untouched) if the content can't be
 * safely rewritten.
 */
export function removeTextInRegions(page: PDFPage, regions: readonly RemovalRegion[]): RedactionResult {
  if (regions.length === 0) return { ok: true, removed: 0, matched: [] };
  try {
    const src = readContent(page);
    if (src === null) return { ok: false, removed: 0, reason: "no-content-stream" };
    const matched = new Array<boolean>(regions.length).fill(false);
    const edits = computeRemovals(src, regions, matched);
    if (edits.length === 0) return { ok: true, removed: 0, matched };
    writeContent(page, applyEdits(src, edits));
    return { ok: true, removed: edits.length, matched };
  } catch (err) {
    return { ok: false, removed: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Content stream read / write (latin1 keeps bytes 1:1 with string offsets)
// ---------------------------------------------------------------------------

function readContent(page: PDFPage): string | null {
  const contents = page.node.Contents();
  if (!contents) return null;
  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const s = contents.lookup(i);
      if (s instanceof PDFRawStream) streams.push(s);
    }
  } else if (contents instanceof PDFRawStream) {
    streams.push(contents);
  }
  if (streams.length === 0) return null;
  // Streams in an array are concatenated; separate with a newline so a token
  // can't accidentally span the join.
  return streams.map((s) => bytesToLatin1(decodePDFRawStream(s).decode())).join("\n");
}

function writeContent(page: PDFPage, content: string): void {
  const bytes = latin1ToBytes(content);
  const stream = page.doc.context.flateStream(bytes);
  const ref = page.doc.context.register(stream);
  page.node.set(PDFName.of("Contents"), ref);
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType = "string" | "hexstring" | "array" | "dict" | "name" | "number" | "op";
interface Token {
  type: TokenType;
  start: number;
  end: number;
  value?: number;
  op?: string;
}

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set("()<>[]{}/%".split("").map((c) => c.charCodeAt(0)));
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function tokenize(s: string): Token[] {
  const toks: Token[] = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (WS.has(c)) {
      i++;
      continue;
    }
    if (c === 37) {
      // %comment → to end of line
      while (i < n && s.charCodeAt(i) !== 10 && s.charCodeAt(i) !== 13) i++;
      continue;
    }
    const start = i;
    if (c === 40) {
      // ( literal string ) with balanced parens + backslash escapes
      let depth = 0;
      for (; i < n; i++) {
        const ch = s.charCodeAt(i);
        if (ch === 92) {
          i++;
          continue;
        }
        if (ch === 40) depth++;
        else if (ch === 41) {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      toks.push({ type: "string", start, end: i });
      continue;
    }
    if (c === 60) {
      if (s.charCodeAt(i + 1) === 60) {
        // << dict >> (balanced)
        let depth = 0;
        for (; i < n; i++) {
          if (s.charCodeAt(i) === 60 && s.charCodeAt(i + 1) === 60) {
            depth++;
            i++;
          } else if (s.charCodeAt(i) === 62 && s.charCodeAt(i + 1) === 62) {
            depth--;
            i++;
            if (depth === 0) {
              i++;
              break;
            }
          }
        }
        toks.push({ type: "dict", start, end: i });
      } else {
        // <hex string>
        while (i < n && s.charCodeAt(i) !== 62) i++;
        i++;
        toks.push({ type: "hexstring", start, end: i });
      }
      continue;
    }
    if (c === 91) {
      // [ array ] — skip strings inside so a ) or ] in a string doesn't confuse us
      let depth = 0;
      for (; i < n; i++) {
        const ch = s.charCodeAt(i);
        if (ch === 40) {
          let d = 0;
          for (; i < n; i++) {
            const k = s.charCodeAt(i);
            if (k === 92) {
              i++;
              continue;
            }
            if (k === 40) d++;
            else if (k === 41) {
              d--;
              if (d === 0) break;
            }
          }
          continue;
        }
        if (ch === 91) depth++;
        else if (ch === 93) {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      toks.push({ type: "array", start, end: i });
      continue;
    }
    if (c === 47) {
      // /name
      i++;
      while (i < n && !WS.has(s.charCodeAt(i)) && !DELIM.has(s.charCodeAt(i))) i++;
      toks.push({ type: "name", start, end: i });
      continue;
    }
    // number or bare keyword (operator)
    let j = i + 1;
    while (j < n && !WS.has(s.charCodeAt(j)) && !DELIM.has(s.charCodeAt(j))) j++;
    const word = s.slice(i, j);
    i = j;
    if (NUMBER_RE.test(word)) toks.push({ type: "number", start, end: i, value: parseFloat(word) });
    else toks.push({ type: "op", start, end: i, op: word });
  }
  return toks;
}

// ---------------------------------------------------------------------------
// Matrix helpers (row-vector affine [a,b,c,d,e,f])
// ---------------------------------------------------------------------------

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Combined transform that applies A then B. */
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// ---------------------------------------------------------------------------
// Interpreter — find the text-show operators to blank
// ---------------------------------------------------------------------------

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Walk the content stream, tracking the CTM and text matrices, and return the
 * byte-range edits that blank the string operand of every show operator whose
 * origin lands inside a region. When `matchedOut` is supplied it is filled with
 * a per-region flag saying whether any operator was blanked inside that region.
 */
export function computeRemovals(src: string, regions: readonly RemovalRegion[], matchedOut?: boolean[]): Edit[] {
  const toks = tokenize(src);
  let ctm: Matrix = [...IDENTITY];
  const ctmStack: Matrix[] = [];
  let tm: Matrix = [...IDENTITY];
  let tlm: Matrix = [...IDENTITY];
  let leading = 0;
  let operands: Token[] = [];
  const edits: Edit[] = [];

  const lastNumbers = (k: number): number[] => {
    const slice = operands.slice(-k);
    if (slice.length !== k || slice.some((t) => t.type !== "number")) return [];
    return slice.map((t) => t.value as number);
  };
  const newline = (): void => {
    tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
    tm = [...tlm];
  };
  const regionIndexAt = (x: number, y: number): number =>
    regions.findIndex((r) => x >= r.x0 - PAD && x <= r.x1 + PAD && y >= r.y0 - PAD && y <= r.y1 + PAD);

  for (const t of toks) {
    if (t.type !== "op") {
      operands.push(t);
      continue;
    }
    switch (t.op) {
      case "q":
        ctmStack.push([...ctm]);
        break;
      case "Q":
        ctm = ctmStack.pop() ?? [...IDENTITY];
        break;
      case "cm": {
        const a = lastNumbers(6);
        if (a.length === 6) ctm = multiply(a as Matrix, ctm);
        break;
      }
      case "BT":
        tm = [...IDENTITY];
        tlm = [...IDENTITY];
        break;
      case "Tm": {
        const a = lastNumbers(6);
        if (a.length === 6) {
          tm = a as Matrix;
          tlm = [...tm];
        }
        break;
      }
      case "Td": {
        const a = lastNumbers(2);
        if (a.length === 2) {
          tlm = multiply([1, 0, 0, 1, a[0], a[1]], tlm);
          tm = [...tlm];
        }
        break;
      }
      case "TD": {
        const a = lastNumbers(2);
        if (a.length === 2) {
          leading = -a[1];
          tlm = multiply([1, 0, 0, 1, a[0], a[1]], tlm);
          tm = [...tlm];
        }
        break;
      }
      case "TL": {
        const a = lastNumbers(1);
        if (a.length === 1) leading = a[0];
        break;
      }
      case "T*":
        newline();
        break;
      case "Tj":
      case "'":
      case '"':
      case "TJ": {
        // ' and " advance to the next line before showing.
        if (t.op === "'" || t.op === '"') newline();
        const [ox, oy] = applyPoint(ctm, tm[4], tm[5]);
        const textTok = operands[operands.length - 1];
        const regionIndex = textTok ? regionIndexAt(ox, oy) : -1;
        if (textTok && regionIndex >= 0) {
          const replacement = textTok.type === "array" ? "[]" : textTok.type === "hexstring" ? "<>" : "()";
          edits.push({ start: textTok.start, end: textTok.end, replacement });
          if (matchedOut) {
            // Mark EVERY region containing this origin, not just the first — two
            // edited lines can overlap and each must know its glyphs are gone.
            for (let ri = 0; ri < regions.length; ri++) {
              const r = regions[ri];
              if (ox >= r.x0 - PAD && ox <= r.x1 + PAD && oy >= r.y0 - PAD && oy <= r.y1 + PAD) matchedOut[ri] = true;
            }
          }
        }
        break;
      }
      default:
        break;
    }
    operands = [];
  }
  return edits;
}

function applyEdits(src: string, edits: Edit[]): string {
  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue; // defensive: skip any overlap
    out += src.slice(pos, e.start) + e.replacement;
    pos = e.end;
  }
  return out + src.slice(pos);
}
