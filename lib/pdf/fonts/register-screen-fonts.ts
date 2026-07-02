/**
 * Registers the bundled faces (Liberation Sans/Serif/Mono, Noto Sans) with the
 * browser via the FontFace API so the editor's font stacks can actually resolve
 * them. Registration is lazy on the browser's side: a FontFace added with a URL
 * source downloads only when text first renders with it, so this costs nothing
 * on machines where the metric-compatible system font (Arial/Times/Courier)
 * exists and wins earlier in the stack.
 *
 * This is what makes on-screen measurement agree with the export engine, which
 * embeds these exact TTFs (see `lib/pdf/editor/export/fonts.ts`) — the other
 * half of the "no line jumping" fix.
 */
import { allFaces } from "./face-map";

let registered = false;

export function ensureScreenFonts(): void {
  if (registered) return;
  if (typeof document === "undefined" || !("fonts" in document) || typeof FontFace === "undefined") return;
  registered = true;
  for (const face of allFaces()) {
    try {
      const ff = new FontFace(face.cssFamily, `url(/fonts/${face.file})`, {
        weight: String(face.weight),
        style: face.style,
      });
      document.fonts.add(ff);
    } catch {
      // A malformed descriptor on an exotic browser must never break editing;
      // the stack simply falls through to the generic family.
    }
  }
}
