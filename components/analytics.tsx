import Script from "next/script";
import { siteConfig } from "@/lib/site";

/**
 * Privacy-first analytics. Loads the lightweight, cookieless Plausible script
 * only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured — so it costs nothing
 * and ships no tracking at all until you opt in.
 */
export function Analytics() {
  if (!siteConfig.plausibleDomain) return null;
  return (
    <Script
      defer
      data-domain={siteConfig.plausibleDomain}
      src="https://plausible.io/js/script.tagged-events.js"
      strategy="afterInteractive"
    />
  );
}
