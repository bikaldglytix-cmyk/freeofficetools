/**
 * Color parsing for the export engine. Converts the model's CSS color strings
 * (`#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`, and a few named colors) into
 * pdf-lib's normalized `RGB` plus a separate alpha channel (pdf-lib takes opacity
 * as a draw option, not part of the color).
 *
 * Unknown input never throws — it falls back to opaque black — because a bad
 * color must not abort an export. Callers that care can compare against
 * {@link FALLBACK_RGB}.
 */
import { rgb, type RGB } from "pdf-lib";

export interface ParsedColor {
  rgb: RGB;
  /** 0..1 */
  alpha: number;
}

export const FALLBACK_RGB: RGB = rgb(0, 0, 0);

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  transparent: "#00000000",
};

/** Parse any supported color string into pdf-lib rgb + alpha. */
export function parseColor(input: string | undefined | null, fallback: ParsedColor = { rgb: FALLBACK_RGB, alpha: 1 }): ParsedColor {
  if (!input) return fallback;
  let value = input.trim().toLowerCase();
  if (value in NAMED) value = NAMED[value];

  if (value.startsWith("#")) return parseHex(value, fallback);
  if (value.startsWith("rgb")) return parseRgbFn(value, fallback);
  return fallback;
}

/** Convenience: just the pdf-lib RGB (drops alpha). */
export function toRgb(input: string | undefined | null, fallback: RGB = FALLBACK_RGB): RGB {
  return parseColor(input, { rgb: fallback, alpha: 1 }).rgb;
}

function parseHex(value: string, fallback: ParsedColor): ParsedColor {
  const hex = value.slice(1);
  let r: number, g: number, b: number, a = 255;
  if (hex.length === 3 || hex.length === 4) {
    r = dup(hex[0]);
    g = dup(hex[1]);
    b = dup(hex[2]);
    if (hex.length === 4) a = dup(hex[3]);
  } else if (hex.length === 6 || hex.length === 8) {
    r = byte(hex, 0);
    g = byte(hex, 2);
    b = byte(hex, 4);
    if (hex.length === 8) a = byte(hex, 6);
  } else {
    return fallback;
  }
  if ([r, g, b, a].some(Number.isNaN)) return fallback;
  return { rgb: rgb(r / 255, g / 255, b / 255), alpha: a / 255 };
}

function parseRgbFn(value: string, fallback: ParsedColor): ParsedColor {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return fallback;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return fallback;
  const channel = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
  const r = channel(parts[0]);
  const g = channel(parts[1]);
  const b = channel(parts[2]);
  const a = parts[3] !== undefined ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
  if ([r, g, b, a].some(Number.isNaN)) return fallback;
  return { rgb: rgb(clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)), alpha: clamp01(a) };
}

const dup = (c: string) => parseInt(c + c, 16);
const byte = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
