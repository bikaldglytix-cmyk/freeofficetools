"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools } from "@/lib/office/tools";
import { cn } from "@/lib/utils";

type SearchResult = {
  name: string;
  short: string;
  url: string;
};

// Flatten all tools into a searchable array
const allTools: SearchResult[] = [
  ...tools.map((t) => ({ name: t.name, short: t.short, url: `/pdf-tools/${t.slug}` })),
  ...mediaTools.map((t) => ({ name: t.name, short: t.short, url: `/media-tools/${t.slug}` })),
  ...officeTools.map((t) => ({ name: t.name, short: t.short, url: `/office-tools/${t.slug}` })),
];

export function ToolSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle modal open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure the element is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
  }, [isOpen]);

  const filteredTools = query
    ? allTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query.toLowerCase()) ||
          tool.short.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Search tools"
      >
        <Search className="size-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-32">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal content */}
          <div className="relative z-[101] w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl animate-in fade-in zoom-in-95 mx-4">
            <div className="flex items-center border-b border-border px-3">
              <Search className="size-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search tools..."
                className="flex h-14 w-full bg-transparent py-3 pl-3 pr-10 text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                className="absolute right-3 rounded-md p-1 opacity-70 hover:opacity-100"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!query ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Search through all PDF, Media, and Office tools...
                </div>
              ) : filteredTools.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No tools found for "{query}"
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTools.map((tool) => (
                    <Link
                      key={tool.url}
                      href={tool.url}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "group flex flex-col gap-0.5 rounded-md px-3 py-3 text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                      )}
                    >
                      <span className="font-semibold text-foreground group-hover:text-primary">
                        {tool.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tool.short}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
