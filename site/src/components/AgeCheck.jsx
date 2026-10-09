import { useEffect, useRef } from "react";
import { scrollBehavior } from "../lib/motion.js";
import { PartBoundary, lazyPart } from "./lazyPart.jsx";

const AgeCheckCharts = lazyPart(() => import("./AgeCheckCharts.jsx"));
export const preloadAgeCheck = () => AgeCheckCharts.preload();

/** About as tall as the chart (the periods' headings, then a 32 px row per group) while its code is on its way. */
function Placeholder({ groups }) {
  return <div className="age-ph" aria-busy="true" style={{ height: 120 + groups * 32 }} />;
}

/**
 * "Check stories of similar age" (idea I1): the panel's heading, Close, the caption and the one-line legend are here,
 * so they appear at once; the chart loads its code on demand. Opened with its button (`takeFocus`), the panel scrolls
 * its heading to the top of the screen and takes focus (F37); opened from an address that already asks for it, it
 * stays where the page put it.
 */
export default function AgeCheck({ meta, view, d, onClose, takeFocus = false, onFocused }) {
  const heading = useRef(null);
  useEffect(() => {
    if (!takeFocus || !heading.current) return;
    heading.current.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
    heading.current.focus({ preventScroll: true });
    onFocused?.();
  }, [takeFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="age-check" aria-labelledby="age-check-title">
      <div className="age-check-head">
        <h3 id="age-check-title" ref={heading} tabIndex={-1}>
          Stories of similar age
        </h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="axis-caption">
        The same chart within three publication periods, so the stories compared are of similar age.
      </p>
      <p className="age-legend">
        Dots: each group’s median within the period. Dashed line: the median of all its stories. Hollow dots: fewer
        than {meta.small_n} stories; a dash: fewer than {meta.min_n}.
      </p>
      <PartBoundary fallback={<Placeholder groups={d.variable.bins.labels.length} />}>
        <AgeCheckCharts meta={meta} view={view} d={d} />
      </PartBoundary>
    </section>
  );
}
