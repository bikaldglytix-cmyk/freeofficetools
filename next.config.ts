import type { NextConfig } from "next";

/*
 * Security headers. The CSP intentionally allows 'unsafe-inline' for scripts so
 * Next's runtime and our JSON-LD blocks work without nonce middleware (a lean
 * MVP tradeoff). Everything else is locked to same-origin plus the optional
 * privacy-friendly analytics host. pdf.js workers run from same-origin/blob.
 */
// In development, React needs 'unsafe-eval' for its debugging features
// (callstack reconstruction, hot reload). Production stays strict — React
// never uses eval() in production mode.
// 'wasm-unsafe-eval' lets the browser compile WebAssembly (FFmpeg.wasm media
// tools); it does NOT permit arbitrary JS eval. 'blob:' covers the FFmpeg core
// worker loaded from a same-origin blob URL. In dev, React also needs
// 'unsafe-eval' for its debugging features.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://plausible.io"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://plausible.io";

// In direct-upload mode the browser POSTs straight to the Office conversion
// backend, so its origin must be allowed for fetch (connect-src). Read from the
// public env var at build time so the CSP stays in sync with the deployment.
function officeBackendOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_OFFICE_BACKEND_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

// `blob:` is required so FFmpeg.wasm's worker can fetch its WebAssembly core
// from the blob URL it creates; without it the wasm fails to instantiate.
const connectSrc = ["connect-src 'self' blob: https://plausible.io", officeBackendOrigin()]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  connectSrc,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Office and media tools used to live at root slugs (/word-to-pdf, /video-to-mp3).
// They now nest under their hub (/office-tools/<slug>, /media-tools/<slug>) to
// match the PDF tools. Permanently redirect the old URLs so existing links and
// any indexed pages don't 404. Keep these in sync with lib/office|media/tools.
const officeToolSlugs = [
  "word-to-pdf",
  "pdf-to-word",
  "excel-to-pdf",
  "pdf-to-excel",
  "powerpoint-to-pdf",
  "pdf-to-powerpoint",
];
const mediaToolSlugs = [
  "video-to-mp3",
  "mp4-to-mp3",
  "audio-converter",
  "mp3-converter",
  "video-compressor",
  "audio-trimmer",
];

const legacyToolRedirects = [
  ...officeToolSlugs.map((slug) => ({
    source: `/${slug}`,
    destination: `/office-tools/${slug}`,
    permanent: true,
  })),
  ...mediaToolSlugs.map((slug) => ({
    source: `/${slug}`,
    destination: `/media-tools/${slug}`,
    permanent: true,
  })),
  { source: "/word-tools", destination: "/office-tools", permanent: true },
  { source: "/excel-tools", destination: "/office-tools", permanent: true },
  { source: "/powerpoint-tools", destination: "/office-tools", permanent: true },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return legacyToolRedirects;
  },
};

export default nextConfig;
