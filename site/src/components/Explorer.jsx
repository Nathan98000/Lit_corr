import { useEffect, useState } from "react";
import { cellStats, endGroups, groupRows, loadVariable, pattern } from "../lib/data.js";
import { ASSOCIATION_NOTE, ageNotes, chartTitle, patternNote, subtitle } from "../lib/wording.js";
import CompareTable from "./CompareTable.jsx";
import Controls from "./Controls.jsx";
import GroupChart from "./GroupChart.jsx";
import NumbersTable from "./NumbersTable.jsx";

export default function Explorer({ meta, state, onChange }) {
  const key = `${state.v}/${state.sub}`;
  const [loaded, setLoaded] = useState(null); // { key, value }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setError(null);
    loadVariable(state.v, state.sub).then(
      (value) => live && setLoaded({ key, value }),
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [key, state.v, state.sub]);

  const variable = meta.variables.find((v) => v.id === state.v);
  const k = meta.metrics.findIndex((m) => m.id === state.metric);
  const metric = meta.metrics[k];
  const genre = meta.genres.find((g) => g.id === state.genre);
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const compare = state.mode === "compare";
  const varData = loaded?.key === key ? loaded.value : null;
  const gd = varData?.g?.[compare ? "all" : genre.id];
  const rows = groupRows(variable, gd, k);
  const overall = cellStats(gd?.o, k);
  const [direction, effect] = pattern(gd, k);
  const title = chartTitle({ variable, metric, genre, direction, compare });
  const sub = subtitle({ genre, subset, n: gd?.n, compare, genreCount: meta.genres.length - 1 });
  const readable = variable.bins.ordered || Boolean(variable.yes_subject);
  const notes = [
    patternNote({
      variable,
      direction,
      effect,
      compare,
      shown: varData ? rows.filter((r) => r.stats && !r.stats.suppressed).length : null,
    }),
    ...ageNotes({ metric, ends: !compare && readable ? endGroups(rows) : null }),
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="explorer" id="explore" aria-label="Explorer">
      <Controls meta={meta} state={state} onChange={onChange} />
      <article className="chart-panel">
        <header className="chart-head">
          <h2 className="chart-title" aria-live="polite">
            {title}
          </h2>
          <p className="chart-sub">{sub}</p>
        </header>
        {error ? (
          <p className="chart-empty">Sorry, this chart could not be loaded ({error}).</p>
        ) : !varData ? (
          <div className="chart-loading" aria-busy="true">
            Loading…
          </div>
        ) : compare ? (
          <CompareTable
            meta={meta}
            variable={variable}
            varData={varData}
            k={k}
            metric={metric}
            smallN={meta.small_n}
            minN={meta.min_n}
            onPickGenre={(id) => onChange({ ...state, mode: "one", genre: id })}
          />
        ) : (
          <GroupChart
            rows={rows}
            overall={overall}
            metric={metric}
            variable={variable}
            smallN={meta.small_n}
            minN={meta.min_n}
            title={title}
          />
        )}
        <div className="notes">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
          <p>
            <strong>{variable.label}.</strong> {variable.description}
            {variable.caveat ? <span className="caveat"> {variable.caveat}</span> : null}
          </p>
          <p>
            <strong>{metric.label}.</strong> {metric.help}
          </p>
          <p className="association">{ASSOCIATION_NOTE}</p>
        </div>
        <div className="chart-actions">
          {!compare && varData && (
            <details className="numbers-details">
              <summary>Show the numbers</summary>
              <NumbersTable rows={rows} overall={overall} metric={metric} minN={meta.min_n} />
            </details>
          )}
          <button type="button" className="link-button copy-link" onClick={copyLink}>
            {copied ? "Link copied" : "Copy a link to this chart"}
          </button>
        </div>
      </article>
    </section>
  );
}
