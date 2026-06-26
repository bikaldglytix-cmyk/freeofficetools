"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">{children}</div>
  );
}

interface PageTileProps {
  url: string;
  label: string;
  selected?: boolean;
  dimmed?: boolean;
  rotation?: number;
  onToggle?: () => void;
  ariaLabel?: string;
  footer?: ReactNode;
}

export function PageTile({
  url,
  label,
  selected,
  dimmed,
  rotation = 0,
  onToggle,
  ariaLabel,
  footer,
}: PageTileProps) {
  const image = (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- client-rendered data URL, not an asset */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-contain transition-transform duration-200"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
      {selected ? (
        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="size-3.5" />
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "rounded-lg p-1.5 transition-opacity",
        selected ? "ring-2 ring-primary" : "ring-1 ring-transparent",
        dimmed && "opacity-40",
      )}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={ariaLabel}
          className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {image}
        </button>
      ) : (
        image
      )}
      <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {footer}
      </div>
    </div>
  );
}
