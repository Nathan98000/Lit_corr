import { useEffect, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion.js";

export const ORDER_GLIDE_MS = 300;
const easeOut = (t) => 1 - (1 - t) ** 3; // the explorer's glide easing (useGlide.js)

/**
 * Rows glide from their old places to their new ones when the order of the genres changes (idea I10), so a reader can
 * follow a genre from A–Z to "By median". `places` maps each moving element's `data-glide` id (a row and its band) to
 * its top in the new layout; `orderKey` is the order, `layoutKey` everything else the places depend on (the
 * characteristic, the option, the width, the highlighted genre): only a new order glides, over 300 ms. The rows are
 * moved with transforms set on the elements themselves, so nothing is laid out again and React draws once. Under
 * reduced motion the rows jump.
 */
export default function useOrderGlide(frame, places, orderKey, layoutKey) {
  const shown = useRef(null);
  const raf = useRef(0);
  useLayoutEffect(() => {
    const prev = shown.current;
    shown.current = { places, orderKey, layoutKey };
    if (!prev || prev.orderKey === orderKey || prev.layoutKey !== layoutKey || prefersReducedMotion()) return;
    const moving = [...(frame.current?.querySelectorAll("[data-glide]") || [])]
      .map((el) => [el, (prev.places.get(el.dataset.glide) ?? places.get(el.dataset.glide)) - places.get(el.dataset.glide)])
      .filter(([, dy]) => dy);
    if (!moving.length) return;
    const frameFn = typeof window !== "undefined" && window.requestAnimationFrame;
    const draw = (k) =>
      moving.forEach(([el, dy]) => (k ? el.setAttribute("transform", `translate(0 ${(dy * k).toFixed(1)})`) : el.removeAttribute("transform")));
    if (raf.current) window.cancelAnimationFrame?.(raf.current);
    draw(1);
    if (!frameFn) {
      draw(0);
      return;
    }
    let t0 = null;
    const step = (now) => {
      if (t0 == null) t0 = now;
      const p = Math.min(1, (now - t0) / ORDER_GLIDE_MS);
      draw(p < 1 ? 1 - easeOut(p) : 0);
      raf.current = p < 1 ? window.requestAnimationFrame(step) : 0;
    };
    raf.current = window.requestAnimationFrame(step);
  });
  useEffect(() => () => raf.current && window.cancelAnimationFrame?.(raf.current), []);
}
