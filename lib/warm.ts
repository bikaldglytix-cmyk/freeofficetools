/**
 * Warm heavy in-browser engines on user intent (hover / focus / touch) so the
 * first real action doesn't stall. Everything here is best-effort: each engine
 * is a cached singleton, so repeat calls are cheap no-ops and nothing ever
 * throws into the UI. Called from <WarmLink> on the tool cards and home tiles.
 *
 * We deliberately warm only what a given tool actually needs:
 *   - media audio/video tools → FFmpeg.wasm (~31 MB core)
 *   - PDF rasterizing tools    → pdf.js
 *   - every PDF tool           → pdf-lib (small, needed by all of them)
 * Office tools convert on the server, so route prefetch (next/link) is enough.
 */
import type { ToolCategory } from "@/lib/links";

// Media slugs whose engine runs on FFmpeg.wasm. Keep in sync with the
// audio/video engines in lib/media/engine.ts (MediaEngine). Image and metadata
// tools use canvas/exifr and are intentionally excluded — no 31 MB download.
const FFMPEG_SLUGS = new Set([
  "video-to-mp3",
  "mp4-to-mp3",
  "audio-converter",
  "mp3-converter",
  "video-compressor",
  "audio-trimmer",
  "mov-to-mp4",
]);

// PDF tools that rasterize pages via pdf.js. Structural tools (merge, split,
// rotate, delete, extract, reorder, jpg-to-pdf) touch only pdf-lib and don't
// need it. Keep in sync with the render paths in lib/tools.ts.
const PDFJS_SLUGS = new Set(["pdf-to-jpg", "compress-pdf", "edit-pdf"]);

const warmed = new Set<string>();

/**
 * True unless the user is on a metered/slow connection. Guards the heavy warms
 * (FFmpeg core, pdf.js) so we never burn cellular data on a hover the user
 * didn't commit to. pdf-lib is small and always allowed.
 */
function heavyWarmAllowed(): boolean {
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  if (typeof conn.effectiveType === "string" && /(^|-)[23]g$/.test(conn.effectiveType)) return false;
  return true;
}

/** Fire-and-forget module warm — swallows load errors so intent never surfaces one. */
function warmModule(load: () => Promise<unknown>): void {
  void Promise.resolve()
    .then(load)
    .catch(() => {});
}

/**
 * Kick off loading the engine(s) a tool will need. Safe to call on every hover;
 * deduped per tool for the lifetime of the page.
 */
export function warmTool(category: ToolCategory, slug: string): void {
  const key = `${category}:${slug}`;
  if (warmed.has(key)) return;
  warmed.add(key);

  if (category === "pdf") {
    // pdf-lib backs every PDF tool and is cheap — always warm it.
    warmModule(() => import("@/lib/pdf/core"));
    if (PDFJS_SLUGS.has(slug) && heavyWarmAllowed()) {
      warmModule(() => import("@/lib/pdf/pdfjs").then((m) => m.getPdfjs()));
    }
    return;
  }

  if (category === "media" && FFMPEG_SLUGS.has(slug) && heavyWarmAllowed()) {
    warmModule(() => import("@/lib/media/ffmpeg").then((m) => m.getFFmpeg()));
  }
}
