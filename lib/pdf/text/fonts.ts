import type { FontReference, TextStyle } from "./types";

const FALLBACKS = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"] as const;

const MONO_RE = /courier|mono|consol/;
const SANS_RE = /sans|arial|helvetica|verdana|calibri|tahoma|segoe|roboto|noto sans|liberation sans|nimbussan|frutiger|univers/;
const SERIF_RE = /serif|times|roman|georgia|garamond|minion|cambria|palatino|book ?antiqua|nimbusrom|liberation serif|stix|cmr|computer modern/;

/** True when the name carries a recognizable serif/sans/mono hint at all. */
export function classifiesFamily(name?: string): boolean {
  if (!name) return false;
  const lower = name.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  return MONO_RE.test(lower) || SANS_RE.test(lower) || SERIF_RE.test(lower);
}

export function analyzePdfFont(name?: string): FontReference {
  const raw = name ?? "Helvetica";
  const withoutSubset = raw.replace(/^[A-Z]{6}\+/, "");
  const lower = withoutSubset.toLowerCase();
  // pdf.js often reports only a generic CSS family ("serif" / "sans-serif" /
  // "monospace") because the embedded font is subsetted. Detect mono and sans
  // first so the "serif" substring inside "sans-serif" never misclassifies.
  const mono = MONO_RE.test(lower);
  const sans = !mono && SANS_RE.test(lower);
  const serif = !mono && !sans && SERIF_RE.test(lower);
  const bold = /bold|black|heavy|demi|semibold|\bmedi\b/.test(lower);
  const italic = /italic|oblique/.test(lower);
  const fallbackFamily = mono ? "Courier New" : serif ? "Times New Roman" : "Arial";

  return {
    id: withoutSubset,
    pdfName: raw,
    family: withoutSubset.replace(/[-_](bold|italic|regular|roman|medium)/gi, " "),
    fallbackFamily,
    weight: bold ? 700 : 400,
    style: italic ? "italic" : "normal",
    embedded: true,
    subset: raw !== withoutSubset,
    available: false,
  };
}

export function matchFont(font: FontReference, available: readonly string[] = FALLBACKS): FontReference {
  const exact = available.find((candidate) => candidate.toLowerCase() === font.family.toLowerCase());
  const fallback = exact ?? available.find((candidate) => candidate === font.fallbackFamily) ?? available[0] ?? "Arial";
  return { ...font, family: exact ?? font.family, fallbackFamily: fallback, available: Boolean(exact) };
}

export function defaultTextStyle(overrides: Partial<TextStyle> = {}): TextStyle {
  const font = overrides.font ?? matchFont(analyzePdfFont("Helvetica"));
  return {
    font,
    fontSize: overrides.fontSize ?? 14,
    color: overrides.color ?? "#111827",
    opacity: overrides.opacity ?? 1,
    bold: overrides.bold ?? font.weight >= 600,
    italic: overrides.italic ?? font.style !== "normal",
    underline: overrides.underline ?? false,
    align: overrides.align ?? "left",
    lineHeight: overrides.lineHeight ?? 1.2,
    letterSpacing: overrides.letterSpacing ?? 0,
    wordSpacing: overrides.wordSpacing ?? 0,
  };
}

function genericFor(family: string): string {
  const lower = family.toLowerCase();
  if (/courier|mono/.test(lower)) return "monospace";
  if (/times|georgia|serif/.test(lower)) return "serif";
  return "sans-serif";
}

/**
 * The CSS font-family stack for rendering edited text: the embedded pdf.js
 * @font-face first (the document's exact glyphs), then the matched/system
 * family, then a generic class — so subset-missing characters degrade to the
 * closest shape instead of the browser default.
 */
export function fontFamilyStack(fontFamily: string | undefined, pdfFontFamily?: string): string {
  const family = fontFamily || "Arial";
  const parts = pdfFontFamily ? [`"${pdfFontFamily}"`] : [];
  parts.push(`"${family}"`, genericFor(family));
  return parts.join(", ");
}

export function cssFontFamily(font: FontReference): string {
  return fontFamilyStack(font.available ? font.family : font.fallbackFamily, font.cssName);
}
