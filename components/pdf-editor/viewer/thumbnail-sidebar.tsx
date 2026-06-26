"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createThumbnailCache, type ThumbnailCache } from "@/lib/pdf/viewer/thumbnails";
import type { ViewerDocument } from "@/lib/pdf/viewer/types";
import { cn } from "@/lib/utils";

interface ThumbnailSidebarProps {
  doc: ViewerDocument;
  currentPage: number;
  onSelect: (index: number) => void;
}

/** Lazy, virtualized-by-visibility page thumbnails with click-to-navigate. */
export function ThumbnailSidebar({ doc, currentPage, onSelect }: ThumbnailSidebarProps) {
  const cache = useMemo<ThumbnailCache>(() => createThumbnailCache(doc), [doc]);
  useEffect(() => () => cache.clear(), [cache]);

  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  return (
    <div className="h-full w-[148px] shrink-0 overflow-y-auto border-r border-border bg-muted/30 p-2">
      <ul className="space-y-2">
        {Array.from({ length: doc.numPages }, (_, i) => (
          <li key={i}>
            <Thumb
              ref={i === currentPage ? activeRef : undefined}
              cache={cache}
              index={i}
              aspect={doc.pageSizes[i].width / doc.pageSizes[i].height}
              active={i === currentPage}
              onSelect={() => onSelect(i)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thumb({
  ref,
  cache,
  index,
  aspect,
  active,
  onSelect,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  cache: ThumbnailCache;
  index: number;
  aspect: number;
  active: boolean;
  onSelect: () => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = holderRef.current;
    if (!el || url) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          cache
            .get(index)
            .then((u) => {
              if (!cancelled) setUrl(u);
            })
            .catch(() => {});
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [cache, index, url]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-label={`Go to page ${index + 1}`}
      aria-current={active}
      className="group block w-full text-center"
    >
      <div
        ref={holderRef}
        className={cn(
          "mx-auto overflow-hidden rounded-sm border bg-white transition-colors",
          active ? "border-primary ring-2 ring-primary" : "border-border group-hover:border-foreground/30",
        )}
        style={{ aspectRatio: String(aspect || 0.7727) }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-rendered data URL
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>
      <span
        className={cn(
          "mt-1 block text-[11px] tabular-nums",
          active ? "font-medium text-primary" : "text-muted-foreground",
        )}
      >
        {index + 1}
      </span>
    </button>
  );
}
