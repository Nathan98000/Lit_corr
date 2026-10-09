import { interpolateNumber } from "d3-interpolate";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion.js";

export const GLIDE_MS = 250;
const easeOut = (t) => 1 - (1 - t) ** 3;
const frame = (f) =>
  typeof window !== "undefined" && window.requestAnimationFrame
    ? window.requestAnimationFrame(f)
    : setTimeout(() => f(Date.now()), 16);
const cancel = (id) =>
  typeof window !== "undefined" && window.cancelAnimationFrame ? window.cancelAnimationFrame(id) : clearTimeout(id);

const sameShape = (a, b) => a.length === b.length && a.every((v, i) => (v == null) === (b[i] == null));
const still = (values) => ({ values, progress: 1, gliding: false, from: null });

/**
 * Glides numbers to their new values over 250 ms with an ease-out curve (idea I3, narrowed by F51): `target` is an
 * array with one array of numbers (or null) per mark. While `key` stays the same, a new target glides; when `key`
 * changes (another characteristic, measure or width) or the marks change shape, they jump; under reduced motion they
 * always jump.
 *
 * Returns `{ values, progress, gliding, from }`: the values to draw now, the eased progress (1 when still), and the
 * `payload` that came with the target the glide started from (the chart keeps its old axis ticks there, so that it
 * can fade them out while the new ones fade in).
 */
export default function useGlide(target, key, payload = null) {
  const sig = JSON.stringify(target);
  const reduced = prefersReducedMotion();
  // what is on screen: the values drawn last, the target they glide to (key, sig, payload) and where they came from
  const shown = useRef({ key, sig, values: target, payload, from: null, progress: 1 });
  const [, redraw] = useState(0);

  useEffect(() => {
    const s = shown.current;
    if (s.key === key && s.sig === sig) return undefined;
    if (s.key !== key || reduced || !sameShape(s.values, target)) {
      shown.current = { key, sig, values: target, payload, from: null, progress: 1 };
      redraw((n) => n + 1);
      return undefined;
    }
    const start = s.values;
    const from = s.payload;
    shown.current = { key, sig, values: start, payload, from, progress: 0 };
    const interp = target.map((t, i) => {
      if (!t) return () => t;
      const parts = t.map((v, j) => interpolateNumber(start[i][j], v));
      return (e) => parts.map((f) => f(e));
    });
    let id;
    let t0 = null;
    const step = (now) => {
      if (t0 == null) t0 = now;
      const p = Math.min(1, (now - t0) / GLIDE_MS);
      const e = easeOut(p);
      shown.current = { key, sig, payload, values: interp.map((f) => f(e)), from: p < 1 ? from : null, progress: p < 1 ? e : 1 };
      redraw((n) => n + 1);
      if (p < 1) id = frame(step);
    };
    id = frame(step);
    return () => cancel(id);
  }, [sig, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = shown.current;
  // another key draws the new marks straight away (no frame with the old positions)
  if (s.key !== key) return still(target);
  if (s.sig !== sig) {
    // a new target whose glide has not started yet: keep drawing what is on screen, or jump when nothing may glide
    if (reduced || !sameShape(s.values, target)) return still(target);
    return { values: s.values, progress: 0, gliding: true, from: s.payload };
  }
  return { values: s.values, progress: s.progress, gliding: s.progress < 1, from: s.from };
}
