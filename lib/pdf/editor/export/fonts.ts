/**
 * Font matching + embedding for export.
 *
 * Edited/added text is embedded with real, metric-compatible open-source fonts
 * (Liberation Sans/Serif/Mono ≈ Arial/Times/Courier, Noto Sans for broad
 * Unicode) so the downloaded PDF shows the SAME typeface the editor showed on
 * screen — the fix for "the font changes after I download". The face mapping is
 * shared with the on-screen renderer via `lib/pdf/fonts/face-map.ts`, so screen
 * and export can't drift.
 *
 * Embedding a TTF with pdf-lib requires `@pdf-lib/fontkit` and is ASYNC, while
 * renderers call `resolveFont` synchronously mid-draw. The pipeline therefore
 * calls {@link FontManager.preload} once up front (async: register fontkit +
 * fetch + embed every needed face), after which `resolveFont` is a pure sync
 * cache lookup. When a face can't be fetched/embedded (e.g. the Node route or a
 * unit test with no `fetch`), it transparently falls back to the 14 PDF
 * Standard Fonts — the previous behaviour, so nothing regresses.
 */
import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";
import {
  faceKey,
  fallbackFace,
  resolveBundledFace,
  type BundledFace,
} from "@/lib/pdf/fonts/face-map";
import type { FontByteLoader } from "./font-loader";
import type { ExportDiagnostic } from "./types";

export interface ResolvedFont {
  font: PDFFont;
  /** The bundled face used, when a real font was embedded. */
  face?: BundledFace;
  /** The standard font used, when we fell back. */
  standard?: StandardFonts;
  /** True when we fell back to a standard font (real face unavailable). */
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

const STANDARD_FAMILY: Record<BundledFace["group"], Family> = {
  "liberation-sans": "helvetica",
  "liberation-serif": "times",
  "liberation-mono": "courier",
  "noto-sans": "helvetica",
};

export interface FontRequest {
  family?: string;
  bold?: boolean;
  italic?: boolean;
}

export class FontManager {
  private readonly standardCache = new Map<StandardFonts, PDFFont>();
  /** Embedded real faces, keyed by {@link faceKey}. */
  private readonly embedded = new Map<string, PDFFont>();
  /** Faces we tried and failed to embed — don't retry, use standard fallback. */
  private readonly unavailable = new Set<string>();
  /** Cached codepoint coverage per embedded face key. */
  private readonly coverage = new Map<string, Set<number>>();
  private readonly diagnostics: ExportDiagnostic[] = [];
  private fontkitRegistered = false;
  private preloaded = false;
  private winAnsi: Set<number> | null = null;

  constructor(private readonly doc: PDFDocument) {}

  /**
   * Register fontkit, fetch and embed every face the given requests (and the
   * Unicode fallback) need — once per document. Safe to call with no loader or
   * in an environment without `fetch`: it simply embeds nothing and every
   * `resolveFont` then falls back to a standard font.
   */
  async preload(requests: readonly FontRequest[], loader: FontByteLoader | null): Promise<void> {
    if (this.preloaded) return;
    this.preloaded = true;
    if (!loader) return;

    await this.registerFontkit();
    if (!this.fontkitRegistered) return;

    // Dedupe the faces we actually need + always include the Unicode fallbacks.
    const faces = new Map<string, BundledFace>();
    for (const req of requests) {
      const primary = resolveBundledFace(req);
      faces.set(faceKey(primary), primary);
      const fb = fallbackFace(req);
      faces.set(faceKey(fb), fb);
    }
    if (faces.size === 0) {
      const fb = fallbackFace();
      faces.set(faceKey(fb), fb);
    }

    let embeddedAny = false;
    for (const [key, face] of faces) {
      try {
        const bytes = await loader(face.file);
        if (!bytes) {
          this.unavailable.add(key);
          continue;
        }
        const font = await this.doc.embedFont(bytes, { subset: true });
        this.embedded.set(key, font);
        embeddedAny = true;
      } catch {
        this.unavailable.add(key);
      }
    }

    if (!embeddedAny) {
      this.diagnostics.push({
        severity: "info",
        code: "FONT_EMBED_FALLBACK",
        message:
          "Bundled fonts could not be loaded in this environment; edited text is rendered with standard PDF fonts (Helvetica/Times/Courier).",
      });
    }
  }

  private async registerFontkit(): Promise<void> {
    if (this.fontkitRegistered) return;
    try {
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      this.doc.registerFontkit(fontkit);
      this.fontkitRegistered = true;
    } catch {
      // fontkit unavailable — leave unregistered; caller falls back.
    }
  }

  /**
   * Resolve the best font for a request. SYNC (a cache lookup) so renderers can
   * call it mid-draw. Returns an embedded real face when {@link preload} loaded
   * one, otherwise a standard font.
   */
  resolveFont(req: FontRequest): ResolvedFont {
    const face = resolveBundledFace(req);
    const font = this.embedded.get(faceKey(face));
    if (font) return { font, face, fallback: false };
    return this.resolveStandard(req);
  }

  /**
   * Resolve the font that should draw `text`: the primary face if it covers
   * every codepoint, else the Unicode fallback face, else a standard font.
   * Used by the text renderer so mixed-script lines don't lose glyphs.
   */
  resolveFontForText(req: FontRequest, text: string): ResolvedFont {
    const primary = this.resolveFont(req);
    if (primary.fallback || !primary.face) return primary;
    if (this.covers(primary.face, primary.font, text)) return primary;

    const fb = fallbackFace(req);
    const fbFont = this.embedded.get(faceKey(fb));
    if (fbFont && this.covers(fb, fbFont, text)) {
      return { font: fbFont, face: fb, fallback: false };
    }
    return primary;
  }

  private resolveStandard(req: FontRequest): ResolvedFont {
    const family = STANDARD_FAMILY[resolveBundledFace(req).group];
    const styleKey = `${req.bold ? "bold" : ""}${req.italic ? "italic" : ""}` || "regular";
    const standard = STANDARD_BY_STYLE[family][styleKey];
    let font = this.standardCache.get(standard);
    if (!font) {
      font = this.doc.embedStandardFont(standard);
      this.standardCache.set(standard, font);
    }
    return { font, standard, fallback: true };
  }

  /** Whether an embedded face has a glyph for every codepoint in `text`. */
  private covers(face: BundledFace, font: PDFFont, text: string): boolean {
    const set = this.coverageFor(face, font);
    if (!set) return true; // couldn't introspect — assume yes, sanitize guards.
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x0a || cp === 0x0d || cp === 0x09 || cp === 0x20) continue;
      if (!set.has(cp)) return false;
    }
    return true;
  }

  private coverageFor(face: BundledFace, font: PDFFont): Set<number> | null {
    const key = faceKey(face);
    const cached = this.coverage.get(key);
    if (cached) return cached;
    // pdf-lib wraps a fontkit font on `.embedder.font`; read its character set.
    const fk = (font as unknown as { embedder?: { font?: { characterSet?: number[] } } }).embedder?.font;
    const chars = fk?.characterSet;
    if (!Array.isArray(chars)) return null;
    const set = new Set<number>(chars);
    this.coverage.set(key, set);
    return set;
  }

  /**
   * Replace characters a STANDARD font cannot encode (WinAnsi only) so a
   * fallback draw never throws. When a real face is embedded this is a no-op —
   * coverage routing already picked a face that has the glyphs, and fontkit
   * embeds any glyph it owns. Only relevant on the standard-font fallback path.
   */
  sanitizeForStandard(text: string, ctx: { pageId?: string; objectId?: string } = {}): string {
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
        message: `${dropped} character(s) fall outside the standard-font charset and were replaced with "?" (bundled Unicode fonts were unavailable here).`,
        pageId: ctx.pageId,
        objectId: ctx.objectId,
      });
    }
    return out;
  }

  /**
   * Resolve the covering font for `text` AND encode it: real faces embed any
   * glyph they own (no substitution); the standard-font fallback path sanitizes
   * to WinAnsi. Convenience for single-shot draws (annotations, signatures,
   * OCR) that don't tokenize like the main text renderer.
   */
  prepare(req: FontRequest, text: string, ctx: { pageId?: string; objectId?: string } = {}): { font: PDFFont; text: string } {
    const resolved = this.resolveFontForText(req, text);
    return {
      font: resolved.font,
      text: resolved.fallback ? this.sanitizeForStandard(text, ctx) : text,
    };
  }

  /** Width of text at a size for a resolved font (used for layout/alignment). */
  widthOf(font: PDFFont, text: string, size: number): number {
    try {
      return font.widthOfTextAtSize(text, size);
    } catch {
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
