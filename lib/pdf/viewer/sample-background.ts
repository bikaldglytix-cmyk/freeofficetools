/**
 * Sample the page canvas around a rect to find the local background colour, so
 * text-edit masks blend into tinted/cream/grey pages instead of stamping an
 * assumed-white box. Reads thin pixel strips just outside each edge and takes
 * the per-channel median — robust against neighbouring glyphs crossing a strip.
 */
import type { Rect } from "@/lib/pdf/editor/model/types";

/**
 * @param rectCss rect in CSS pixels relative to the canvas box.
 * @returns a CSS colour, or null when pixels can't be read (detached canvas).
 */
export function sampleBackgroundColor(canvas: HTMLCanvasElement, rectCss: Rect): string | null {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0 || !canvas.clientWidth) return null;
  const scale = canvas.width / canvas.clientWidth;
  const x = rectCss.x * scale;
  const y = rectCss.y * scale;
  const w = rectCss.width * scale;
  const h = rectCss.height * scale;
  const gap = Math.max(2, 3 * scale); // sample just OUTSIDE the glyph ink
  const strip = Math.max(1, Math.round(scale));

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const grab = (sx: number, sy: number, sw: number, sh: number) => {
    const cx = Math.max(0, Math.min(canvas.width - 1, Math.round(sx)));
    const cy = Math.max(0, Math.min(canvas.height - 1, Math.round(sy)));
    const cw = Math.max(1, Math.min(canvas.width - cx, Math.round(sw)));
    const ch = Math.max(1, Math.min(canvas.height - cy, Math.round(sh)));
    try {
      const data = ctx.getImageData(cx, cy, cw, ch).data;
      // Every 4th pixel is plenty for a median and keeps this O(strip length).
      for (let i = 0; i < data.length; i += 16) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    } catch {
      /* tainted/detached canvas — caller falls back to white */
    }
  };

  grab(x - gap, y - gap - strip, w + gap * 2, strip); // above
  grab(x - gap, y + h + gap, w + gap * 2, strip); // below
  grab(x - gap - strip, y - gap, strip, h + gap * 2); // left
  grab(x + w + gap, y - gap, strip, h + gap * 2); // right

  if (rs.length === 0) return null;
  return `rgb(${median(rs)},${median(gs)},${median(bs)})`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
