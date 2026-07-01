"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so repeat visits are instant and offline-capable (see the
 * caching strategy in public/sw.js). Registration is deferred to `load` so it
 * never competes with the initial render, and skipped in development to avoid
 * the service worker caching HMR assets and fighting Turbopack.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort: the app works fine without the SW */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
