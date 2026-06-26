"use client";

import { useEffect, useRef } from "react";
import { Search, ChevronUp, ChevronDown, X, Loader2 } from "lucide-react";
import type { SearchStatus } from "@/components/pdf-editor/hooks/use-pdf-search";

interface SearchPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  status: SearchStatus;
  matchCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/** Floating find bar: query input, result counter, and prev/next navigation. */
export function SearchPanel({
  query,
  onQueryChange,
  status,
  matchCount,
  activeIndex,
  onNext,
  onPrev,
  onClose,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const hasQuery = query.trim().length > 0;
  const counter = !hasQuery
    ? ""
    : status === "indexing"
      ? "…"
      : matchCount === 0
        ? "0/0"
        : `${activeIndex + 1}/${matchCount}`;

  return (
    <div className="absolute right-3 top-2 z-20 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-lift)]">
      <span className="pl-1.5 text-muted-foreground">
        {status === "indexing" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Find in document"
        aria-label="Find in document"
        className="h-7 w-44 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">{counter}</span>
      <button
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="Next match"
        title="Next match (Enter)"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronDown className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        title="Close (Esc)"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
