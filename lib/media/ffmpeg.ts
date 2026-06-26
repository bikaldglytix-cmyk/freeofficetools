/**
 * Lazy, single-instance FFmpeg.wasm loader.
 *
 * The ~31 MB core is fetched only the first time a media tool actually runs,
 * never on page load, and is reused across tools for the rest of the session.
 * The single-threaded core is used on purpose: it needs no SharedArrayBuffer
 * and therefore no cross-origin-isolation (COOP/COEP) headers, keeping the
 * rest of the site simple. The core is served same-origin from /public/ffmpeg,
 * so nothing — not the binary, and never the user's file — touches a server.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const CORE_BASE = "/ffmpeg";

let ffmpegPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })();
    // Don't cache a failed load — let the next attempt retry from scratch.
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

/** True once the core has been loaded in this session. */
export function isFFmpegLoaded(): boolean {
  return ffmpegPromise !== null;
}
