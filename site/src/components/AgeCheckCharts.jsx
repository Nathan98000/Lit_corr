import { useEffect, useState } from "react";
import { cellStats, groupRows, loadVariable, pattern } from "../lib/data.js";
import { formatCount } from "../lib/format.js";
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

/** Three chart-sized frames while the three files are on their way. */
function AgeCheckPlaceholder() {
  return (
    <div className="age-check-grid" aria-busy="true">
      {PERIODS.map((p) => (
        <div key={p} className="ph-chart age-ph" />
      ))}
    </div>
  );
}

/**
 * The charts of "Check stories of similar age" (idea I1): the same chart within three publication periods, side by
 * side on wide screens and stacked on phones, on one shared scale. Loads the three existing files on demand.
 */
export default function AgeCheckCharts({ meta, view, d }) {
  const [files, setFiles] = useState(null);
  const [failed, setFailed] = useState(false);
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

  if (failed) return <p className="muted">We couldn’t load these charts. Check your connection and try again.</p>;
  if (!files) return <AgeCheckPlaceholder />;
  const periods = PERIODS.map((p, i) => {
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
  });
  const allRows = periods.flatMap((p) => p.rows);
  return (
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
  );
}
