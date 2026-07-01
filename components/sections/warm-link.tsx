"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ToolCategory } from "@/lib/links";
import { warmTool } from "@/lib/warm";

/**
 * A next/link that also warms a tool's in-browser engine the moment the user
 * shows intent (hover, keyboard focus, or touch). By the time the click lands,
 * FFmpeg.wasm / pdf.js / pdf-lib is already downloading, so the first action
 * feels instant instead of stalling on a cold engine.
 *
 * next/link already prefetches the route; this only adds the engine warm.
 * Children are rendered on the server and passed through untouched.
 */
export function WarmLink({
  href,
  warmCategory,
  warmSlug,
  className,
  children,
}: {
  href: string;
  warmCategory: ToolCategory;
  warmSlug: string;
  className?: string;
  children: ReactNode;
}) {
  const warm = () => warmTool(warmCategory, warmSlug);
  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
    >
      {children}
    </Link>
  );
}
