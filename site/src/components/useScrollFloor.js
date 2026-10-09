import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the page where it is when a new question makes it shorter (round 3). A shorter chart would otherwise let the
 * browser pull the page up, as the screen may not reach past the end of the page. `hold()`, called just before the
 * sentence changes the question, gives a spacer between `main` and the footer the height that keeps the page tall
 * enough for the current scroll position, whatever the height of the new chart (main is at least one screen tall);
 * the spacer goes as soon as it is out of sight below the screen, so nothing visible moves. Returns [ref, hold]:
 * `ref` goes on the spacer, right after `main`.
 */
export default function useScrollFloor() {
  const ref = useRef(null);

  const hold = useCallback(() => {
    const floor = ref.current;
    const main = floor?.previousElementSibling;
    if (!floor || !main) return;
    const screenH = document.documentElement.clientHeight || window.innerHeight;
    // the shortest the page can get: main's top, its minimum height, then the spacer and what follows it
    const mainTop = main.getBoundingClientRect().top + window.scrollY;
    const mainMin = parseFloat(getComputedStyle(main).minHeight) || 0;
    const after = floor.nextElementSibling?.offsetHeight ?? 0;
    const height = Math.max(0, Math.ceil(window.scrollY + screenH - mainTop - mainMin - after));
    floor.style.height = height ? `${height}px` : "";
  }, []);

  useEffect(() => {
    const release = () => {
      const floor = ref.current;
      if (!floor?.offsetHeight) return;
      const screenH = document.documentElement.clientHeight || window.innerHeight;
      if (floor.getBoundingClientRect().top >= screenH) floor.style.height = "";
    };
    window.addEventListener("scroll", release, { passive: true });
    return () => window.removeEventListener("scroll", release);
  }, []);

  return [ref, hold];
}
