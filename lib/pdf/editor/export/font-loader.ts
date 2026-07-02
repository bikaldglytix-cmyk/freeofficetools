/**
 * Font byte loading for export. Fetches the bundled TTFs from `public/fonts/`
 * at runtime and caches the bytes so repeated exports (and multi-page docs)
 * fetch each face at most once.
 *
 * Works on the browser main thread and inside a Web Worker (same-origin
 * `fetch('/fonts/...')`). In a pure Node context (the API route, unit tests)
 * `fetch` of a relative URL fails; the loader returns null and the FontManager
 * falls back to the standard-14 fonts — the pre-existing behaviour, so nothing
 * regresses where fonts can't be fetched.
 */
export type FontByteLoader = (file: string) => Promise<Uint8Array | null>;

const cache = new Map<string, Promise<Uint8Array | null>>();

function originBase(): string | null {
  // Browser window or Worker global — both expose `location`.
  const loc = (globalThis as { location?: { origin?: string } }).location;
  return loc?.origin ?? null;
}

async function fetchFontBytes(file: string): Promise<Uint8Array | null> {
  if (typeof fetch !== "function") return null;
  const base = originBase();
  const url = base ? new URL(`/fonts/${file}`, base).toString() : `/fonts/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** The default env-aware loader with a module-level byte cache. */
export const defaultFontLoader: FontByteLoader = (file) => {
  const hit = cache.get(file);
  if (hit) return hit;
  const p = fetchFontBytes(file);
  cache.set(file, p);
  // Don't cache a rejected/failed promise forever — but fetchFontBytes never
  // rejects (it catches), so a null result is a legitimate "unavailable here".
  return p;
};
