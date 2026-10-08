// Motion only for visitors who have not asked their system to reduce it.

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** "smooth" scrolling unless reduced motion is preferred. */
export const scrollBehavior = () => (prefersReducedMotion() ? "auto" : "smooth");
