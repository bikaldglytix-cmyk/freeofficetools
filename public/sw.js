/*
 * FreeOfficeTools service worker.
 *
 * Goal: make repeat visits instant and offline-capable without ever serving a
 * stale app. Strategy is intentionally conservative:
 *
 *   - Immutable, content-addressed assets (Next's /_next/static, the FFmpeg
 *     WASM core in /ffmpeg, favicons, icon) → CACHE FIRST. These never change
 *     under a fixed URL, so a cache hit is always correct and the 31 MB FFmpeg
 *     core is fetched from disk on the second visit instead of the network.
 *   - Navigations / HTML → NETWORK FIRST, falling back to cache offline. This
 *     guarantees a new deploy is picked up immediately (no stuck old app).
 *   - Everything else (cross-origin analytics, the Office backend, POSTs,
 *     range requests) → passthrough, never touched.
 *
 * Bump CACHE_VERSION to force old caches to be dropped on activate.
 */
const CACHE_VERSION = "v1";
const PRECACHE = `fot-precache-${CACHE_VERSION}`;
const RUNTIME = `fot-runtime-${CACHE_VERSION}`;

// Same-origin path prefixes whose responses are safe to cache forever because
// the URL changes whenever the bytes change (or the bytes never change).
const IMMUTABLE_PREFIXES = ["/_next/static/", "/ffmpeg/", "/favicon/"];
const IMMUTABLE_EXACT = new Set(["/icon.svg", "/manifest.webmanifest"]);

function isImmutable(url) {
  if (IMMUTABLE_EXACT.has(url.pathname)) return true;
  return IMMUTABLE_PREFIXES.some((p) => url.pathname.startsWith(p));
}

self.addEventListener("install", (event) => {
  // Activate this worker as soon as it's installed rather than waiting for all
  // tabs to close — paired with clients.claim() below for a fast handover.
  self.skipWaiting();
  event.waitUntil(caches.open(PRECACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME && k.startsWith("fot-"))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Only cache complete, successful responses (skip 206/opaque/errors).
  if (response && response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only ever touch our own origin — analytics and the Office backend pass through.
  if (url.origin !== self.location.origin) return;
  // Respect explicit no-store (e.g. the SW file itself).
  if (request.cache === "no-store") return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
