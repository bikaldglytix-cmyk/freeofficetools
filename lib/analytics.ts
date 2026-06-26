/**
 * Tiny, dependency-free event helper. Safely no-ops when analytics is not
 * loaded, so tool code can always call track() without guards.
 */
type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: PlausibleProps }) => void;
  }
}

export function track(event: string, props?: PlausibleProps) {
  if (typeof window === "undefined") return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break a tool */
  }
}

/** Standard tool funnel events, kept consistent across every tool. */
export const ToolEvents = {
  fileAdded: "Tool: File Added",
  started: "Tool: Started",
  completed: "Tool: Completed",
  failed: "Tool: Failed",
  downloaded: "Tool: Downloaded",
} as const;
