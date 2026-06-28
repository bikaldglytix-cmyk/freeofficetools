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
import { analyzePdfFont, cssFontFamily, matchFont } from "./fonts";

export interface RichResult {
  /** Flattened plain text (the block's source-of-truth `text`). */
  text: string;
  /** Per-run styling; `[]` when the content is empty. */
  runs: TextRun[];
}

/** The block-level defaults a run inherits when it sets no override. */
export interface RunBaseStyle {
  fontFamily: string;
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
    fontSize: style.fontSize,
    color: style.color,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
  };
}

/** One run per native span (adjacent equal-style spans are merged). */
export function runsFromSpans(spans: readonly TextSpan[]): TextRun[] {
  return normalizeRuns(spans.map((s) => runFromStyle(s.text, s.style)));
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Identity of a run's *style* (ignores its text), used to coalesce neighbours. */
export function runStyleKey(r: TextRun): string {
  return [
    (r.fontFamily ?? "").toLowerCase(),
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
  const css = [
    `font-family:${cssFamily(family)}`,
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

/** Map a CSS font-family list back to one of our known families. */
function mapFamily(cssValue: string, fallback: string): string {
  const first = cssValue.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  if (!first) return fallback;
  const matched = matchFont(analyzePdfFont(first));
  return matched.available ? matched.family : first;
}

function styleFromElement(el: Element, base: RunBaseStyle, zoom: number): Omit<TextRun, "text"> {
  const cs = getComputedStyle(el);
  const weight = cs.fontWeight;
  const px = parseFloat(cs.fontSize);
  const deco = `${cs.textDecorationLine || ""} ${cs.textDecoration || ""}`;
  return {
    fontFamily: mapFamily(cs.fontFamily, base.fontFamily),
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

/** A concrete CSS font stack for a family name (reuses the export mapping). */
function cssFamily(family: string): string {
  return cssFontFamily(matchFont(analyzePdfFont(family)));
}
