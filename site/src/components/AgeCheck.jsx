import { useEffect, useRef } from "react";
import { scrollBehavior } from "../lib/motion.js";
import { PartBoundary, lazyPart } from "./lazyPart.jsx";

const AgeCheckCharts = lazyPart(() => import("./AgeCheckCharts.jsx"));
export const preloadAgeCheck = () => AgeCheckCharts.preload();

/** Three chart-sized frames while the charts' code is on its way (the charts show the same while their files load). */
function Placeholder() {
  return (
    <div className="age-check-grid" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ph-chart age-ph" />
      ))}
    </div>
  );
}

/**
 * "Check stories of similar age" (idea I1): the panel's heading and Close are here, so they appear at once; the
 * three charts load their code on demand. Opened with its button (`takeFocus`), the panel scrolls its heading to the
 * top of the screen and takes focus (F37); opened from an address that already asks for it, it stays where the page
 * put it.
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
      <PartBoundary fallback={<Placeholder />}>
        <AgeCheckCharts meta={meta} view={view} d={d} />
      </PartBoundary>
    </section>
  );
}
