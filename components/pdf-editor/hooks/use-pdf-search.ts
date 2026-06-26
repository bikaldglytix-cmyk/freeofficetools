"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDocumentIndex, searchDocument, type PageTextIndex } from "@/lib/pdf/viewer/search";
import type { SearchMatch, ViewerDocument } from "@/lib/pdf/viewer/types";

export type SearchStatus = "idle" | "indexing" | "ready";

export interface UsePdfSearch {
  query: string;
  setQuery: (q: string) => void;
  status: SearchStatus;
  matches: SearchMatch[];
  /** Highlight rects grouped by page index, for the page overlays. */
  matchesByPage: Map<number, SearchMatch[]>;
  activeIndex: number;
  active: SearchMatch | null;
  next: () => void;
  prev: () => void;
  clear: () => void;
}

const DEBOUNCE_MS = 180;

/**
 * Full-text search over the whole document. The page text index is built once
 * per document on the first query (then cached), so an empty search box costs
 * nothing and large PDFs only pay the indexing price if the user actually
 * searches.
 */
export function usePdfSearch(doc: ViewerDocument | null): UsePdfSearch {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const indexRef = useRef<PageTextIndex[] | null>(null);
  const buildingRef = useRef<Promise<PageTextIndex[]> | null>(null);

  // Drop the cached index and reset search state whenever the document changes.
  // This synchronizes with an external system (a freshly loaded pdf.js document),
  // so the scoped exception below is deliberate.
  useEffect(() => {
    indexRef.current = null;
    buildingRef.current = null;
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery("");
    setMatches([]);
    setStatus("idle");
    setActiveIndex(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [doc]);

  const ensureIndex = useCallback(async (): Promise<PageTextIndex[]> => {
    if (indexRef.current) return indexRef.current;
    if (buildingRef.current) return buildingRef.current;
    if (!doc) return [];
    setStatus("indexing");
    const build = buildDocumentIndex(doc).then((idx) => {
      indexRef.current = idx;
      buildingRef.current = null;
      return idx;
    });
    buildingRef.current = build;
    return build;
  }, [doc]);

  // Debounced query → results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // Clearing the box clears results; synchronizing with the (debounced)
      // external search pipeline, so the scoped exception is deliberate.
      /* eslint-disable react-hooks/set-state-in-effect */
      setMatches([]);
      setStatus(indexRef.current ? "ready" : "idle");
      setActiveIndex(0);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const index = await ensureIndex();
      if (cancelled) return;
      const found = searchDocument(index, q);
      setMatches(found);
      setActiveIndex(0);
      setStatus("ready");
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ensureIndex]);

  const next = useCallback(() => {
    setActiveIndex((i) => (matches.length ? (i + 1) % matches.length : 0));
  }, [matches.length]);

  const prev = useCallback(() => {
    setActiveIndex((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
  }, [matches.length]);

  const clear = useCallback(() => {
    setQuery("");
    setMatches([]);
    setActiveIndex(0);
  }, []);

  const matchesByPage = useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    for (const m of matches) {
      const list = map.get(m.pageIndex);
      if (list) list.push(m);
      else map.set(m.pageIndex, [m]);
    }
    return map;
  }, [matches]);

  const active = matches[activeIndex] ?? null;

  return { query, setQuery, status, matches, matchesByPage, activeIndex, active, next, prev, clear };
}
