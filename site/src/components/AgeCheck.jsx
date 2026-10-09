import { useEffect, useRef, useState } from "react";
import { cellStats, groupRows, loadVariable, pattern } from "../lib/data.js";
import { formatCount } from "../lib/format.js";
import { scrollBehavior } from "../lib/motion.js";
import { chartTitle } from "../lib/wording.js";
import RangeChart from "./RangeChart.jsx";

export const PERIODS = ["y2000", "y2010", "y2020"];

/** The existing verdict for one chart, in words. */
export function verdictWords(variable, [direction, effect]) {
  if (!(variable.bins.ordered || variable.yes_subject)) return null;
  if (effect == null) return "too few stories to judge";
  if (direction > 0) return "↗ tends higher";
  if (direction < 0) return "↘ tends lower";
  return "no clear pattern";
}

/**
 * "Check stories of similar age" (idea I1): the same chart within three publication periods, side by side on wide
 * screens and stacked on phones, on one shared scale. Loads the three existing files on demand. Opened with its
 * button (`takeFocus`), it scrolls its heading to the top of the screen and takes focus (F37); opened from an address
 * that already asks for it, it stays where the page put it.
 */
export default function AgeCheck({ meta, view, d, onClose, takeFocus = false, onFocused }) {
  const [files, setFiles] = useState(null);
  const [failed, setFailed] = useState(false);
  const heading = useRef(null);
  useEffect(() => {
    if (!takeFocus || !heading.current) return;
    heading.current.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
    heading.current.focus({ preventScroll: true });
    onFocused?.();
  }, [takeFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    Promise.all(PERIODS.map((p) => loadVariable(view.v, p))).then(
      (fs) => live && setFiles(fs),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [view.v]);

  const periods = files
    ? PERIODS.map((p, i) => {
        const gd = files[i].g[view.genre];
        const rows = groupRows(d.variable, gd, d.k);
        return {
          id: p,
          subset: meta.subsets.find((s) => s.id === p),
          gd,
          rows,
          overall: cellStats(gd?.o, d.k),
          verdict: verdictWords(d.variable, pattern(gd, d.k)),
          direction: pattern(gd, d.k)[0],
        };
      })
    : null;
  const allRows = periods ? periods.flatMap((p) => p.rows) : null;

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
      {failed ? (
        <p className="muted">We couldn’t load these charts. Check your connection and try again.</p>
      ) : !periods ? (
        <div className="age-check-grid" aria-busy="true">
          {PERIODS.map((p) => (
            <div key={p} className="ph-chart age-ph" />
          ))}
        </div>
      ) : (
        <div className="age-check-grid">
          {periods.map((p) => (
            <div key={p.id} className="age-period">
              <h4>{p.subset.label}</h4>
              <p className="age-period-meta">
                {formatCount(p.gd?.n ?? 0)} stories
                {p.verdict && (
                  <>
                    {" · "}
                    <span className={p.direction > 0 ? "up" : p.direction < 0 ? "down" : "flat"}>{p.verdict}</span>
                  </>
                )}
              </p>
              <RangeChart
                compact
                rows={p.rows}
                overall={p.overall}
                metric={d.metric}
                variable={d.variable}
                smallN={meta.small_n}
                minN={meta.min_n}
                n={p.gd?.n}
                domainRows={allRows}
                title={`${chartTitle({
                  variable: d.variable,
                  metric: d.metric,
                  genre: d.genre,
                  direction: p.direction,
                })}, ${p.subset.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
