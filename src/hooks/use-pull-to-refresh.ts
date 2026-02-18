import { useRef, useCallback, useEffect } from "react";

interface Options {
  onRefresh: () => void;
  threshold?: number; // px pull distance to trigger
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Attaches touch-based pull-to-refresh to a scrollable container.
 * Call onRefresh when the user pulls down far enough.
 */
export function usePullToRefresh({ onRefresh, threshold = 72, containerRef }: Options) {
  const startY   = useRef<number | null>(null);
  const pulling  = useRef(false);

  const getEl = useCallback(
    () => (containerRef?.current ?? document.documentElement),
    [containerRef],
  );

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (getEl().scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) e.preventDefault(); // suppress native bounce
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.changedTouches[0].clientY - startY.current;
      if (delta >= threshold) onRefresh();
      pulling.current = false;
      startY.current  = null;
    };

    const el = getEl();
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [getEl, onRefresh, threshold]);
}
