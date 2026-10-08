import { useEffect, useState } from "react";
import { cellStats, endGroups, groupRows, loadVariable, pattern } from "../lib/data.js";
import { ASSOCIATION_NOTE, ageNotes, chartTitle, patternNote, subtitle } from "../lib/wording.js";
import CompareTable from "./CompareTable.jsx";
import Controls from "./Controls.jsx";
import CopyLink from "./CopyLink.jsx";
import GroupChart from "./GroupChart.jsx";
import LoadError from "./LoadError.jsx";
import NumbersTable from "./NumbersTable.jsx";

const fileKey = (s) => `${s.v}/${s.sub}`;

/**
 * Keeps the chart that is on screen until the next one has loaded: `shown` is the last file that arrived and the
 * settings it belongs to. While a new file loads, the previous chart, heading and notes stay (dimmed, aria-busy),
 * so nothing is ever worded from data that is not there yet.
 */
export function useShownData(state) {
  const key = fileKey(state);
  const [shown, setShown] = useState(null); // { key, v, sub, value }
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    loadVariable(state.v, state.sub).then(
      (value) => live && setShown({ key, v: state.v, sub: state.sub, value }),
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [key, state.v, state.sub, attempt]);

  const busy = !error && (!shown || shown.key !== key);
  // The settings the visible chart describes: today's genre, measure and mode, with the file's characteristic and
  // "only include" option (they differ from today's only while the next file is loading).
  const view = shown ? { ...state, v: shown.v, sub: shown.sub } : null;
  return { view, data: shown?.value ?? null, busy, error, retry: () => setAttempt((a) => a + 1) };
}

/** Everything the chart panel says about one view, computed only from loaded data. */
export function describeView(meta, view, data) {
  const variable = meta.variables.find((v) => v.id === view.v);
  const k = meta.metrics.findIndex((m) => m.id === view.metric);
  const metric = meta.metrics[k];
  const genre = meta.genres.find((g) => g.id === view.genre);
  const subset = meta.subsets.find((s) => s.id === view.sub);
  const compare = view.mode === "compare";
  const gd = data?.g?.[compare ? "all" : genre.id];
  const rows = groupRows(variable, gd, k);
  const overall = cellStats(gd?.o, k);
  const [direction, effect] = pattern(gd, k);
  const title = chartTitle({ variable, metric, genre, direction, compare });
  const sub = subtitle({ genre, subset, n: gd?.n, compare, genreCount: meta.genres.length - 1 });
  const readable = variable.bins.ordered || Boolean(variable.yes_subject);
  const shownCount = rows.filter((r) => r.stats && !r.stats.suppressed).length;
  const notes = [
    patternNote({ variable, direction, effect, compare, shown: shownCount }),
    ...ageNotes({ metric, ends: !compare && readable ? endGroups(rows) : null }),
  ];
  return { variable, k, metric, genre, subset, compare, gd, rows, overall, direction, effect, title, sub, notes };
}

export default function Explorer({ meta, state, onChange }) {
  const { view, data, busy, error, retry } = useShownData(state);
  const d = view ? describeView(meta, view, data) : null;

  return (
    <section className="explorer" id="explore" aria-label="Explorer">
      <Controls meta={meta} state={state} onChange={onChange} />
      <p className="visually-hidden" aria-live="polite">
        {!busy && d ? d.title : ""}
      </p>
      {error ? (
        <article className="chart-panel">
          <LoadError onRetry={retry} detail={error} />
        </article>
      ) : !d ? (
        <ChartPlaceholder />
      ) : (
        <article className={`chart-panel${busy ? " is-busy" : ""}`} aria-busy={busy}>
          <header className="chart-head">
            <h2 className="chart-title">{d.title}</h2>
            <p className="chart-sub">{d.sub}</p>
          </header>
          {d.compare ? (
            <CompareTable
              meta={meta}
              variable={d.variable}
              varData={data}
              k={d.k}
              metric={d.metric}
              smallN={meta.small_n}
              minN={meta.min_n}
              onPickGenre={(id) => onChange({ ...state, mode: "one", genre: id })}
            />
          ) : (
            <GroupChart
              rows={d.rows}
              overall={d.overall}
              metric={d.metric}
              variable={d.variable}
              smallN={meta.small_n}
              minN={meta.min_n}
              title={d.title}
            />
          )}
          <div className="notes">
            {d.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
            <p>
              <strong>{d.variable.label}.</strong> {d.variable.description}
              {d.variable.caveat ? <span className="caveat"> {d.variable.caveat}</span> : null}
            </p>
            <p>
              <strong>{d.metric.label}.</strong> {d.metric.help}
            </p>
            <p className="association">{ASSOCIATION_NOTE}</p>
          </div>
          <div className="chart-actions">
            {!d.compare && (
              <details className="numbers-details">
                <summary>Show the numbers</summary>
                <NumbersTable rows={d.rows} overall={d.overall} metric={d.metric} minN={meta.min_n} />
              </details>
            )}
            <CopyLink />
          </div>
        </article>
      )}
    </section>
  );
}

/** A chart-sized empty frame for the very first load, so the page does not jump when the chart arrives. */
export function ChartPlaceholder() {
  return (
    <article className="chart-panel chart-placeholder" aria-busy="true" aria-label="The chart is loading">
      <div className="ph-line ph-title" />
      <div className="ph-line ph-sub" />
      <div className="ph-chart" />
    </article>
  );
}
