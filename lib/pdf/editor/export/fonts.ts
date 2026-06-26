/**
 * Font matching + embedding for export.
 *
 * FREE-LIBRARY LIMITATION (documented, not a bug): embedding arbitrary TTF/OTF
 * fonts with pdf-lib requires the optional `@pdf-lib/fontkit` package, which is
 * not a dependency of this project. We therefore render *added/edited* text with
 * the 14 PDF Standard Fonts (Helvetica/Times/Courier families). Consequences:
 *   1. Original (untouched) page text is unaffected — it stays in the copied
 *      source page with its own embedded fonts at 100% fidelity.
 *   2. Edited/added text is mapped to the closest standard family + weight/style.
 *      This is the dominant fidelity tradeoff for the "edit text" workflow.
 *   3. Standard fonts only cover the WinAnsi (≈CP1252) charset. Characters
 *      outside it (CJK, most emoji) cannot be drawn; we substitute a placeholder
 *      and raise a FONT_GLYPH diagnostic rather than throwing.
 * To lift (2)/(3), add `@pdf-lib/fontkit`, call `doc.registerFontkit(...)` and
 * embed real font bytes — `resolveFont` is the single seam to extend.
 */
import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";
import type { ExportDiagnostic } from "./types";

export interface ResolvedFont {
  font: PDFFont;
  /** The standard font actually used. */
  standard: StandardFonts;
  /** True if we fell back from a non-standard requested family. */
  fallback: boolean;
}

type Family = "helvetica" | "times" | "courier";

const STANDARD_BY_STYLE: Record<Family, Record<string, StandardFonts>> = {
  helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    bolditalic: StandardFonts.HelveticaBoldOblique,
  },
  times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    bolditalic: StandardFonts.TimesRomanBoldItalic,
  },
  courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    bolditalic: StandardFonts.CourierBoldOblique,
  },
};

export interface FontRequest {
  family?: string;
  bold?: boolean;
  italic?: boolean;
}

export class FontManager {
  private readonly cache = new Map<StandardFonts, PDFFont>();
  private readonly diagnostics: ExportDiagnostic[] = [];
  private winAnsi: Set<number> | null = null;

  constructor(private readonly doc: PDFDocument) {}

  /** Resolve + embed (cached) the best standard font for a request. */
  resolveFont(req: FontRequest): ResolvedFont {
    const family = classifyFamily(req.family);
    const fallback = family.fallback;
    const styleKey = `${req.bold ? "bold" : ""}${req.italic ? "italic" : ""}` || "regular";
    const standard = STANDARD_BY_STYLE[family.family][styleKey];
    let font = this.cache.get(standard);
    if (!font) {
      font = this.doc.embedStandardFont(standard);
      this.cache.set(standard, font);
    }
    return { font, standard, fallback };
  }

  /**
   * Replace characters the standard fonts cannot encode so drawText never
   * throws. Returns sanitized text; raises one diagnostic per object that lost
   * glyphs (not per character, to avoid diagnostic floods).
   */
  sanitize(text: string, ctx: { pageId?: string; objectId?: string } = {}): string {
    const set = this.winAnsiSet();
    let dropped = 0;
    let out = "";
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x0a || cp === 0x0d || cp === 0x09 || set.has(cp)) {
        out += ch;
      } else {
        out += "?";
        dropped++;
      }
    }
    if (dropped > 0) {
      this.diagnostics.push({
        severity: "warning",
        code: "FONT_GLYPH",
        message: `${dropped} character(s) are outside the WinAnsi charset of the standard fonts and were replaced with "?". Add @pdf-lib/fontkit to embed a Unicode font.`,
        pageId: ctx.pageId,
        objectId: ctx.objectId,
      });
    }
    return out;
  }

  /** Width of text at a size for the resolved font (used for layout/alignment). */
  widthOf(font: PDFFont, text: string, size: number): number {
    try {
      return font.widthOfTextAtSize(text, size);
    } catch {
      // Defensive: should not happen after sanitize, but never let layout throw.
      return text.length * size * 0.5;
    }
  }

  heightOf(font: PDFFont, size: number): number {
    return font.heightAtSize(size);
  }

  takeDiagnostics(): ExportDiagnostic[] {
    return this.diagnostics.splice(0);
  }

  private winAnsiSet(): Set<number> {
    if (this.winAnsi) return this.winAnsi;
    const set = new Set<number>();
    for (let cp = 0x20; cp <= 0x7e; cp++) set.add(cp);
    for (let cp = 0xa0; cp <= 0xff; cp++) set.add(cp);
    // CP1252 0x80–0x9F printable additions.
    for (const cp of [
      0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
      0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122,
      0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
    ]) {
      set.add(cp);
    }
    this.winAnsi = set;
    return set;
  }
}

/** Heuristically map a CSS/PDF font family to a standard family bucket. */
function classifyFamily(name?: string): { family: Family; fallback: boolean } {
  if (!name) return { family: "helvetica", fallback: false };
  const lower = name.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  if (/courier|mono|consol/.test(lower)) return { family: "courier", fallback: !/courier/.test(lower) };
  if (/times|georgia|garamond|serif|roman|minion|book antiqua|palatino/.test(lower)) {
    return { family: "times", fallback: !/times/.test(lower) };
  }
  if (/helvetica|arial|sans|calibri|segoe|verdana|tahoma|roboto|open sans/.test(lower)) {
    return { family: "helvetica", fallback: !/helvetica/.test(lower) };
  }
  // Unknown family → Helvetica, flagged as a fallback.
  return { family: "helvetica", fallback: true };
}
