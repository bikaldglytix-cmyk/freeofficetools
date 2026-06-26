"use client";

import { useEffect, useState } from "react";

export interface ScrollMetrics {
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Track a scroll container's scroll offset and content-box size. Scroll updates
 * are throttled to one per animation frame. The viewer derives page layout from
 * the width and the visible page range from the scroll offset, so keeping this
 * hook free of layout avoids a width→layout→width dependency cycle.
 */
export function useScrollMetrics(scrollEl: HTMLElement | null): ScrollMetrics {
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  useEffect(() => {
    if (!scrollEl) return;
    let frame = 0;

    const sync = () => {
      frame = 0;
      setMetrics({
        scrollTop: scrollEl.scrollTop,
        viewportWidth: scrollEl.clientWidth,
        viewportHeight: scrollEl.clientHeight,
      });
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };

    sync();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(sync);
    resize.observe(scrollEl);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scrollEl.removeEventListener("scroll", onScroll);
      resize.disconnect();
    };
  }, [scrollEl]);

  return metrics;
}
