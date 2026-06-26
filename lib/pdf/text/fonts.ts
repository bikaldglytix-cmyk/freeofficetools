import type { FontReference, TextStyle } from "./types";

const FALLBACKS = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"] as const;

export function analyzePdfFont(name?: string): FontReference {
  const raw = name ?? "Helvetica";
  const withoutSubset = raw.replace(/^[A-Z]{6}\+/, "");
  const lower = withoutSubset.toLowerCase();
  const serif = /times|serif|garamond|georgia/.test(lower);
  const mono = /courier|mono|console/.test(lower);
  const bold = /bold|black|heavy|demi/.test(lower);
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

export function cssFontFamily(font: FontReference): string {
  return `"${font.available ? font.family : font.fallbackFamily}", ${font.fallbackFamily.includes("Times") ? "serif" : font.fallbackFamily.includes("Courier") ? "monospace" : "sans-serif"}`;
}
