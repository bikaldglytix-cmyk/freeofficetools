"use client";

import { useCallback, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

/**
 * Observe an element's content-box size with a ResizeObserver. Returns a ref
 * callback to attach and the latest size. Used to drive fit-to-width zoom and
 * layout centering off the live viewport width.
 *
 * Uses React 19's ref-callback cleanup return to disconnect the observer when
 * the node detaches.
 */
export function useElementSize(): [(node: HTMLElement | null) => (() => void) | void, Size] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
