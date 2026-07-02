/**
 * Shared font-face mapping — the single source of truth that maps an extracted
 * PDF font family name to a bundled, metric-compatible open-source face.
 *
 * Used by BOTH the on-screen editor (`lib/pdf/text/fonts.ts`) and the export
 * engine (`lib/pdf/editor/export/fonts.ts`) so what you see while editing and
 * what lands in the downloaded PDF are the same typeface — the fix for the
 * "font changes after download" complaint. Keep this module DOM-free and
 * pdf-lib-free so it runs in the browser, a Web Worker, and Node tests.
 *
 * The bundled faces (under `public/fonts/`) are chosen for metric compatibility
 * with the fonts real-world PDFs overwhelmingly use:
 *   - Liberation Sans  ≈ Arial / Helvetica       (sans)
 *   - Liberation Serif ≈ Times New Roman         (serif)
 *   - Liberation Mono  ≈ Courier New             (mono)
 *   - Noto Sans        — broad Unicode fallback  (glyphs the above lack)
 */

export type FaceGroupId = "liberation-sans" | "liberation-serif" | "liberation-mono" | "noto-sans";

export type StyleKey = "regular" | "bold" | "italic" | "bolditalic";

export interface BundledFace {
  group: FaceGroupId;
  styleKey: StyleKey;
  /** File under `public/fonts/`. */
  file: string;
  /** Stable CSS `@font-face` family name used on screen (see `fonts.css`). */
  cssFamily: string;
  weight: 400 | 700;
  style: "normal" | "italic";
}

/** A key that uniquely identifies an embedded face for caching. */
export function faceKey(face: BundledFace): string {
  return `${face.group}:${face.styleKey}`;
}

const CSS_FAMILY: Record<FaceGroupId, string> = {
  "liberation-sans": "Liberation Sans",
  "liberation-serif": "Liberation Serif",
  "liberation-mono": "Liberation Mono",
  "noto-sans": "Noto Sans",
};

const FILE_STEM: Record<FaceGroupId, string> = {
  "liberation-sans": "LiberationSans",
  "liberation-serif": "LiberationSerif",
  "liberation-mono": "LiberationMono",
  "noto-sans": "NotoSans",
};

const STYLE_SUFFIX: Record<StyleKey, string> = {
  regular: "Regular",
  bold: "Bold",
  italic: "Italic",
  bolditalic: "BoldItalic",
};

// Mono/sans BEFORE serif so the "serif" substring inside "sans-serif" never
// misclassifies (mirrors the ordering in lib/pdf/text/fonts.ts).
const MONO_RE = /courier|mono|consol/;
const SANS_RE =
  /sans|arial|helvetica|verdana|calibri|tahoma|segoe|roboto|noto ?sans|liberation ?sans|nimbussan|frutiger|univers|lato|open ?sans|inter/;
const SERIF_RE =
  /serif|times|roman|georgia|garamond|minion|cambria|palatino|book ?antiqua|nimbusrom|liberation ?serif|stix|cmr|computer modern|spectral|merriweather/;

/** Strip a pdf.js subset prefix ("ABCDEF+") and lowercase for matching. */
function normalizeName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, "").toLowerCase();
}

/**
 * Classify a font family name into one of the bundled groups. `matched` is true
 * when the name carried a recognizable serif/sans/mono hint (vs. a blind
 * sans-serif default), so callers can tell a confident mapping from a guess.
 */
export function classifyFamily(name?: string): { group: FaceGroupId; matched: boolean } {
  if (!name) return { group: "liberation-sans", matched: false };
  const lower = normalizeName(name);
  if (MONO_RE.test(lower)) return { group: "liberation-mono", matched: true };
  if (SANS_RE.test(lower)) return { group: "liberation-sans", matched: true };
  if (SERIF_RE.test(lower)) return { group: "liberation-serif", matched: true };
  return { group: "liberation-sans", matched: false };
}

function styleKeyOf(bold: boolean, italic: boolean): StyleKey {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

export interface FaceRequest {
  family?: string;
  bold?: boolean;
  italic?: boolean;
}

function makeFace(group: FaceGroupId, styleKey: StyleKey): BundledFace {
  return {
    group,
    styleKey,
    file: `${FILE_STEM[group]}-${STYLE_SUFFIX[styleKey]}.ttf`,
    cssFamily: CSS_FAMILY[group],
    weight: styleKey === "bold" || styleKey === "bolditalic" ? 700 : 400,
    style: styleKey === "italic" || styleKey === "bolditalic" ? "italic" : "normal",
  };
}

/**
 * Resolve the bundled face for a font request. Weight/slant come from the
 * explicit booleans first, then fall back to hints embedded in the family name
 * (e.g. "Spectral-Bold", "Helvetica-Oblique").
 */
export function resolveBundledFace(req: FaceRequest): BundledFace {
  const { group } = classifyFamily(req.family);
  const lower = req.family ? normalizeName(req.family) : "";
  const bold = req.bold ?? /bold|black|heavy|demi|semibold|\bmedi\b/.test(lower);
  const italic = req.italic ?? /italic|oblique/.test(lower);
  return makeFace(group, styleKeyOf(bold, italic));
}

/** The Unicode fallback face for glyphs the primary face lacks. */
export function fallbackFace(req: FaceRequest = {}): BundledFace {
  const lower = req.family ? normalizeName(req.family) : "";
  const bold = req.bold ?? /bold|black|heavy|demi|semibold|\bmedi\b/.test(lower);
  const italic = req.italic ?? /italic|oblique/.test(lower);
  return makeFace("noto-sans", styleKeyOf(bold, italic));
}

/** Every face the loader may need, for @font-face generation / preloading. */
export function allFaces(): BundledFace[] {
  const groups: FaceGroupId[] = ["liberation-sans", "liberation-serif", "liberation-mono", "noto-sans"];
  const styles: StyleKey[] = ["regular", "bold", "italic", "bolditalic"];
  return groups.flatMap((g) => styles.map((s) => makeFace(g, s)));
}

/** The CSS family name a request maps to (used by the on-screen font stack). */
export function bundledCssFamily(req: FaceRequest): string {
  return resolveBundledFace(req).cssFamily;
}
