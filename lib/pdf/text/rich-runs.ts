/**
 * Rich-text run helpers — the bridge between styled `TextRun[]` (the model) and
 * the DOM of the in-place `contentEditable` editor.
 *
 * WHY THIS EXISTS: a single line can mix formatting (e.g. only **keywords** is
 * bold in `keywords: one, two, three`). The model has always had `TextRun[]` and
 * the export renderer can draw them, but the editor collapsed every edit to a
 * single block-level style — so changing any part of a line re-stamped the whole
 * line in one weight. These helpers let the editor seed itself from per-run
 * formatting and serialize back to runs on commit, so untouched spans keep their
 * exact style and only the characters the user actually changed are affected.
 *
 * COORDINATES: run `fontSize` is in PDF points; the editor paints at
 * `fontSize * zoom` px, so seeding multiplies by zoom and serializing divides by
 * it. Everything else (color/family/weight/slant) is resolution-independent.
 */
import type { TextRun } from "@/lib/pdf/editor/model/types";
import type { TextSpan, TextStyle } from "./types";
import { analyzePdfFont, fontFamilyStack, matchFont } from "./fonts";

export interface RichResult {
  /** Flattened plain text (the block's source-of-truth `text`). */
  text: string;
  /** Per-run styling; `[]` when the content is empty. */
  runs: TextRun[];
}

/** The block-level defaults a run inherits when it sets no override. */
export interface RunBaseStyle {
  fontFamily: string;
  /** Embedded pdf.js @font-face family, rendered before `fontFamily`. */
  pdfFontFamily?: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
}

const ZWSP = "​";

// ---------------------------------------------------------------------------
// Build runs from extracted native spans (seed the editor with real formatting)
// ---------------------------------------------------------------------------

function runFromStyle(text: string, style: TextStyle): TextRun {
  return {
    text,
    fontFamily: style.font.available ? style.font.family : style.font.fallbackFamily,
    pdfFontFamily: style.font.cssName,
    fontSize: style.fontSize,
    color: style.color,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
  };
}

/**
 * One run per native glyph run (adjacent equal-style runs are merged). A span
 * groups glyphs by word gap, not by style, so a single span can mix fonts —
 * e.g. a serif name next to a sans label on the same line. Walking the glyph
 * runs keeps each part's own face/size instead of flattening the span to its
 * first glyph's style.
 */
export function runsFromSpans(spans: readonly TextSpan[]): TextRun[] {
  const out: TextRun[] = [];
  for (const s of spans) {
    if (!s.runs?.length) {
      out.push(runFromStyle(s.text, s.style));
      continue;
    }
    for (const r of s.runs) out.push(runFromStyle(r.text, r.style));
    // The span's text may carry a synthesized trailing word gap not present in
    // any glyph run — keep it so line text round-trips unchanged.
    const joined = s.runs.map((r) => r.text).join("");
    if (s.text.length > joined.length && s.text.startsWith(joined)) {
      out[out.length - 1].text += s.text.slice(joined.length);
    }
  }
  return normalizeRuns(out);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Identity of a run's *style* (ignores its text), used to coalesce neighbours. */
export function runStyleKey(r: TextRun): string {
  return [
    (r.fontFamily ?? "").toLowerCase(),
    r.pdfFontFamily ?? "",
    r.fontSize ?? "",
    (r.color ?? "").toLowerCase(),
    r.bold ? 1 : 0,
    r.italic ? 1 : 0,
    r.underline ? 1 : 0,
  ].join("|");
}

/** Merge adjacent runs that share a style and drop empty (non-break) runs. */
export function normalizeRuns(runs: readonly TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && runStyleKey(last) === runStyleKey(r)) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Runs → HTML (seed the contentEditable once, imperatively)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runCss(r: TextRun, base: RunBaseStyle, zoom: number): string {
  const family = r.fontFamily ?? base.fontFamily;
  const pdfFamily = r.pdfFontFamily ?? (r.fontFamily === undefined ? base.pdfFontFamily : undefined);
  const css = [
    `font-family:${cssFamily(family, pdfFamily)}`,
    `font-size:${(r.fontSize ?? base.fontSize) * zoom}px`,
    `color:${r.color ?? base.color}`,
    `font-weight:${(r.bold ?? base.bold) ? 700 : 400}`,
    `font-style:${(r.italic ?? base.italic) ? "italic" : "normal"}`,
  ];
  if (r.underline ?? base.underline) css.push("text-decoration:underline");
  return css.join(";");
}

/** Serialise runs to HTML for seeding the editor. `\n` becomes a `<br>`. */
export function runsToHtml(runs: readonly TextRun[], base: RunBaseStyle, zoom: number): string {
  const effective = runs.length ? runs : [{ text: "" } as TextRun];
  let html = "";
  for (const r of effective) {
    const segments = r.text.split("\n");
    segments.forEach((seg, i) => {
      if (i > 0) html += "<br>";
      // A zero-width space keeps an otherwise-empty run/box selectable & visible.
      html += `<span style="${runCss(r, base, zoom)}">${esc(seg) || ZWSP}</span>`;
    });
  }
  return html;
}

// ---------------------------------------------------------------------------
// DOM → runs (read the edited content back out on commit)
// ---------------------------------------------------------------------------

function rgbToHex(value: string): string | null {
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (!m) return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
  const [r, g, b] = m[1].split(",").map((n) => Math.round(parseFloat(n)));
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  const h = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** pdf.js registers embedded fonts under loaded names like "g_d0_f3". */
const PDF_FACE_RE = /^g_d\d+_f/;

/**
 * Map a computed CSS font-family list back to `{ fontFamily, pdfFontFamily }`.
 * The embedded pdf.js face (if present in the stack) is carried separately so
 * committed runs keep rendering with the document's exact glyphs.
 */
function mapFamily(cssValue: string, base: RunBaseStyle): { fontFamily: string; pdfFontFamily?: string } {
  const entries = cssValue
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  const pdfFontFamily = entries.find((e) => PDF_FACE_RE.test(e));
  const first = entries.find((e) => !PDF_FACE_RE.test(e));
  if (!first) return { fontFamily: base.fontFamily, pdfFontFamily: pdfFontFamily ?? base.pdfFontFamily };
  const matched = matchFont(analyzePdfFont(first));
  // A bare generic keyword ("serif") maps to its concrete fallback family.
  const fontFamily = matched.available
    ? matched.family
    : /^(serif|sans-serif|monospace)$/.test(first)
      ? matched.fallbackFamily
      : first;
  return { fontFamily, pdfFontFamily };
}

function styleFromElement(el: Element, base: RunBaseStyle, zoom: number): Omit<TextRun, "text"> {
  const cs = getComputedStyle(el);
  const weight = cs.fontWeight;
  const px = parseFloat(cs.fontSize);
  const deco = `${cs.textDecorationLine || ""} ${cs.textDecoration || ""}`;
  return {
    ...mapFamily(cs.fontFamily, base),
    fontSize: Number.isFinite(px) && px > 0 ? Math.round((px / zoom) * 10) / 10 : base.fontSize,
    color: rgbToHex(cs.color) ?? base.color,
    bold: weight === "bold" || (parseInt(weight, 10) || 400) >= 600,
    italic: /italic|oblique/.test(cs.fontStyle),
    underline: /underline/.test(deco),
  };
}

/**
 * Read the editor's DOM back into `{ text, runs }`. Each text node's effective
 * style is taken from its parent's computed style, so it works regardless of
 * whether the browser produced `<b>`, `<span style>` or `<font>` while editing.
 * `<br>` and block wrappers (`<div>`/`<p>`) become `\n`.
 */
export function serializeDom(root: HTMLElement, base: RunBaseStyle, zoom: number): RichResult {
  const runs: TextRun[] = [];
  let text = "";

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const raw = (child.textContent ?? "").replace(new RegExp(ZWSP, "g"), "");
        if (!raw) continue;
        const parent = child.parentElement ?? root;
        runs.push({ text: raw, ...styleFromElement(parent, base, zoom) });
        text += raw;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          runs.push({ text: "\n" });
          text += "\n";
          continue;
        }
        // A block wrapper after existing content starts a new visual line.
        if (/^(DIV|P)$/.test(el.tagName) && text.length > 0) {
          runs.push({ text: "\n" });
          text += "\n";
        }
        walk(el);
      }
    }
  };
  walk(root);

  return { text, runs: normalizeRuns(runs) };
}

// ---------------------------------------------------------------------------

/** A concrete CSS font stack for a family name, embedded face first. */
function cssFamily(family: string, pdfFontFamily?: string): string {
  const matched = matchFont(analyzePdfFont(family));
  return fontFamilyStack(matched.available ? matched.family : matched.fallbackFamily, pdfFontFamily);
}
