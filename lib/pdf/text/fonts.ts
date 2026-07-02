import { classifyFamily, resolveBundledFace, type FaceGroupId } from "@/lib/pdf/fonts/face-map";
import type { FontReference, TextStyle } from "./types";

const FALLBACKS = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"] as const;

// The system family each bucket falls back to on screen. Metric-compatible
// with the bundled face the export engine embeds for the same bucket.
const SYSTEM_FALLBACK: Record<FaceGroupId, string> = {
  "liberation-sans": "Arial",
  "liberation-serif": "Times New Roman",
  "liberation-mono": "Courier New",
  "noto-sans": "Arial",
};

/** True when the name carries a recognizable serif/sans/mono hint at all.
 *  Classification lives in the shared face-map so screen and export agree. */
export function classifiesFamily(name?: string): boolean {
  return classifyFamily(name).matched;
}

export function analyzePdfFont(name?: string): FontReference {
  const raw = name ?? "Helvetica";
  const withoutSubset = raw.replace(/^[A-Z]{6}\+/, "");
  const lower = withoutSubset.toLowerCase();
  const bold = /bold|black|heavy|demi|semibold|\bmedi\b/.test(lower);
  const italic = /italic|oblique/.test(lower);
  const fallbackFamily = SYSTEM_FALLBACK[classifyFamily(withoutSubset).group];

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
  const group = classifyFamily(family).group;
  if (group === "liberation-mono") return "monospace";
  if (group === "liberation-serif") return "serif";
  return "sans-serif";
}

/**
 * The CSS font-family stack for rendering edited text: the embedded pdf.js
 * @font-face first (the document's exact glyphs), then the matched/system
 * family, then the BUNDLED face the export engine will embed (registered via
 * `ensureScreenFonts`), then a generic class. Ending in the bundled face means
 * on-screen measurement and the downloaded PDF share metrics even on machines
 * without Arial/Times installed — edits wrap identically in both.
 */
export function fontFamilyStack(fontFamily: string | undefined, pdfFontFamily?: string): string {
  const family = fontFamily || "Arial";
  const bundled = resolveBundledFace({ family }).cssFamily;
  const parts = pdfFontFamily ? [`"${pdfFontFamily}"`] : [];
  parts.push(`"${family}"`);
  if (bundled.toLowerCase() !== family.toLowerCase()) parts.push(`"${bundled}"`);
  parts.push(genericFor(family));
  return parts.join(", ");
}

export function cssFontFamily(font: FontReference): string {
  return fontFamilyStack(font.available ? font.family : font.fallbackFamily, font.cssName);
}
