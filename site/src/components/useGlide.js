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

/**
 * Glides numbers to their new values over 250 ms with an ease-out curve (idea I3): `target` is an array with one
 * array of numbers (or null) per mark. When `key` changes (another characteristic, another width) the marks jump;
 * under reduced motion they always jump.
 */
export default function useGlide(target, key) {
  const [shown, setShown] = useState(target);
  const last = useRef({ key, values: target });
  const signature = JSON.stringify(target);

  useEffect(() => {
    const from = last.current;
    const sameShape =
      from.key === key &&
      from.values.length === target.length &&
      from.values.every((v, i) => (v == null) === (target[i] == null));
    if (!sameShape || prefersReducedMotion()) {
      last.current = { key, values: target };
      setShown(target);
      return undefined;
    }
    const interp = target.map((t, i) => {
      if (!t) return () => t;
      const parts = t.map((v, j) => interpolateNumber(from.values[i][j], v));
      return (e) => parts.map((f) => f(e));
    });
    let id;
    let start = null;
    const step = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / GLIDE_MS);
      const values = interp.map((f) => f(easeOut(p)));
      last.current = { key, values };
      setShown(values);
      if (p < 1) id = frame(step);
    };
    id = frame(step);
    return () => cancel(id);
  }, [signature, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // a new key draws the new marks straight away (no frame with the old positions)
  return last.current.key === key && shown.length === target.length ? shown : target;
}
