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
      const next = {
        scrollTop: scrollEl.scrollTop,
        viewportWidth: scrollEl.clientWidth,
        viewportHeight: scrollEl.clientHeight,
      };
      setMetrics((current) =>
        current.scrollTop === next.scrollTop &&
        current.viewportWidth === next.viewportWidth &&
        current.viewportHeight === next.viewportHeight
          ? current
          : next,
      );
    };
    const requestSync = () => {
      if (frame) return;
      frame = requestAnimationFrame(sync);
    };

    sync();
    scrollEl.addEventListener("scroll", requestSync, { passive: true });
    const resize = new ResizeObserver(requestSync);
    resize.observe(scrollEl);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scrollEl.removeEventListener("scroll", requestSync);
      resize.disconnect();
    };
  }, [scrollEl]);

  return metrics;
}
