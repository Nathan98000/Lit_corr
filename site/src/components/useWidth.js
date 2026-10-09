import { useLayoutEffect, useRef, useState } from "react";

// The last width measured for each kind of element (`key`), so that a chart drawn again (another characteristic or
// measure remounts it) starts at its real width instead of the fallback.
const remembered = new Map();

/**
 * Width of an element, kept up to date as the layout changes (charts redraw to fit). Until the element has been
 * measured, the width is the one last measured for the same `key`, or `fallback` but never wider than the window
 * minus the page's padding: a chart drawn wider than the screen for even one layout makes phone browsers widen the
 * page, and the scroll position jumps (round 3).
 */
export default function useWidth(fallback = 720, key = null) {
  const ref = useRef(null);
  const [width, setWidth] = useState(() => {
    if (key && remembered.has(key)) return remembered.get(key);
    const screen = typeof window !== "undefined" && window.innerWidth ? window.innerWidth - 32 : fallback;
    return Math.max(1, Math.min(fallback, screen));
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        setWidth(Math.round(w));
        if (key) remembered.set(key, Math.round(w));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return [ref, width];
}
