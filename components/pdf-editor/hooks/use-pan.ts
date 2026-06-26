"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Click-and-drag panning for the scroll container.
 *
 * Panning is enabled when the hand tool is active OR the space bar is held
 * (a temporary override, like most editors), and middle-mouse drag always pans.
 * While panning we disable text selection so the drag doesn't select glyphs.
 */
export function usePan(scrollEl: HTMLElement | null, handToolActive: boolean) {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  // Space toggles a temporary pan mode while the viewer has focus/hover.
  useEffect(() => {
    if (!scrollEl) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    scrollEl.addEventListener("keydown", down);
    scrollEl.addEventListener("keyup", up);
    return () => {
      scrollEl.removeEventListener("keydown", down);
      scrollEl.removeEventListener("keyup", up);
    };
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) return;
    const canPanWithLeft = handToolActive || spaceHeld;

    const onPointerDown = (e: PointerEvent) => {
      const isMiddle = e.button === 1;
      const isLeftPan = e.button === 0 && canPanWithLeft;
      if (!isMiddle && !isLeftPan) return;
      e.preventDefault();
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        left: scrollEl.scrollLeft,
        top: scrollEl.scrollTop,
      };
      setPanning(true);
      scrollEl.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      scrollEl.scrollLeft = start.left - (e.clientX - start.x);
      scrollEl.scrollTop = start.top - (e.clientY - start.y);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current = null;
      setPanning(false);
      if (scrollEl.hasPointerCapture(e.pointerId)) scrollEl.releasePointerCapture(e.pointerId);
    };

    scrollEl.addEventListener("pointerdown", onPointerDown);
    scrollEl.addEventListener("pointermove", onPointerMove);
    scrollEl.addEventListener("pointerup", onPointerUp);
    scrollEl.addEventListener("pointercancel", onPointerUp);
    return () => {
      scrollEl.removeEventListener("pointerdown", onPointerDown);
      scrollEl.removeEventListener("pointermove", onPointerMove);
      scrollEl.removeEventListener("pointerup", onPointerUp);
      scrollEl.removeEventListener("pointercancel", onPointerUp);
    };
  }, [scrollEl, handToolActive, spaceHeld]);

  const panCursorActive = handToolActive || spaceHeld;
  return { panning, panCursorActive };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
