import { useEffect, useId, useState } from "react";
import { cellStats, endGroups, groupRows, loadVariable, pattern } from "../lib/data.js";
import { chartValueText } from "../lib/rangeLayout.js";
import {
  ASSOCIATION_NOTE,
  RATE_FOR,
  ageNotes,
  answerHeading,
  chartTitle,
  oneGroupNote,
  patternNote,
  subtitle,
  takeawaySegments,
} from "../lib/wording.js";
import { toHash } from "../lib/urlState.js";
import AgeCheck from "./AgeCheck.jsx";
import ChartNotes from "./ChartNotes.jsx";
import { compareRows, compareSummary } from "../lib/compare.js";
import CompareGrid from "./CompareGrid.jsx";
import CompareTable from "./CompareTable.jsx";
import Controls from "./Controls.jsx";
import CopyLink from "./CopyLink.jsx";
import LoadError from "./LoadError.jsx";
import NumbersTable from "./NumbersTable.jsx";
import RangeChart from "./RangeChart.jsx";
import useMediaQuery from "./useMediaQuery.js";

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
  const shownRows = rows.filter((r) => r.stats && !r.stats.suppressed);
  const shownCount = shownRows.length;
  const pNote = patternNote({ variable, direction, effect, compare, shown: shownCount });
  const ageWarnings = ageNotes({ metric, ends: !compare && readable ? endGroups(rows) : null });
  const valueText = chartValueText(rows, overall, metric.format);
  const cRows = compare ? compareRows({ meta, variable, varData: data, k, smallN: meta.small_n }) : null;
  const answer = compare
    ? (readable && compareSummary(cRows)) || "Each group on its own"
    : answerHeading({ variable, metric, genre, direction, effect, shown: shownCount });
  const takeaway = compare || shownCount < 2 ? null : takeawaySegments({ variable, rows, valueText });
  const oneGroup = !compare && shownCount === 1 ? shownRows[0] : null;
  return {
    variable,
    k,
    metric,
    genre,
    subset,
    compare,
    gd,
    rows,
    overall,
    direction,
    effect,
    title,
    sub,
    ageNotes: ageWarnings,
    compareRows: cRows,
    readable,
    pNote,
    answer,
    takeaway,
    oneGroup,
    shownCount,
  };
}

/** The takeaway line: plain text with the numbers in bold, then how clear the pattern is. */
function Takeaway({ segments, note, why }) {
  return (
    <p className="takeaway">
      {segments &&
        segments.map((seg, i) => (typeof seg === "string" ? seg : <strong key={i}>{seg.strong}</strong>))}{" "}
      {note && <span className="takeaway-note">{note}</span>}
      {why && (
        <>
          {" "}
          <a className="why" href={toHash("methodology", { section: "tend-to" })}>
            Why no clear pattern?
          </a>
        </>
      )}
    </p>
  );
}

/**
 * Next questions (idea I2): the per-month or per-1,000-views version when the measure is a total, and the next
 * two characteristics in the same topic's order. Never chosen by their results.
 */
export function nextQuestions(meta, view) {
  const out = [];
  const metric = meta.metrics.find((m) => m.id === view.metric);
  const rateId = RATE_FOR[metric.id];
  const rate = rateId && meta.metrics.find((m) => m.id === rateId);
  if (rate) {
    out.push({ key: "rate", text: `The same chart with ${rate.label.toLowerCase()}`, state: { ...view, metric: rate.id } });
  }
  const variable = meta.variables.find((v) => v.id === view.v);
  const topic = meta.topics.find((t) => t.id === variable.topic);
  if (topic && topic.ids.length > 1) {
    const i = topic.ids.indexOf(variable.id);
    const picks = [1, 2].map((j) => topic.ids[(i + j) % topic.ids.length]).filter((id) => id !== variable.id);
    for (const id of [...new Set(picks)]) {
      const v = meta.variables.find((x) => x.id === id);
      out.push({ key: id, text: `${v.label}`, prefix: `Next in ${topic.label}: `, state: { ...view, v: id, check: undefined } });
    }
  }
  return out;
}

export default function Explorer({ meta, state, onChange }) {
  const { view, data, busy, error, retry } = useShownData(state);
  const d = view ? describeView(meta, view, data) : null;
  const [showNumbers, setShowNumbers] = useState(false);
  const numbersId = useId();
  const wide = useMediaQuery("(min-width: 900px)");
  const genreCount = meta.genres.length - 1;

  useEffect(() => {
    if (d && !busy) document.title = d.title;
  }, [d?.title, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const ageCheckOpen = Boolean(
    d && !d.compare && view.check === "age" && view.sub === "all" && d.ageNotes.some((n) => n.kind === "groups"),
  );
  const next = view && !d?.compare ? nextQuestions(meta, view) : [];

  return (
    <section className="explorer" id="explore" aria-label="Explorer">
      <Controls meta={meta} state={state} onChange={onChange} />
      <p className="visually-hidden" aria-live="polite">
        {!busy && d ? d.answer : ""}
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
            <h2 className="chart-title">{d.answer}</h2>
            <p className="chart-sub">{d.sub}</p>
          </header>
          {d.compare ? (
            <>
              <p className="compare-caption">
                Each small chart is one genre. A dot is a group’s typical story compared with that genre’s own typical
                story (the dashed line); the shaded band runs from 0.67× to 1.5×. Hollow dots: fewer than{" "}
                {meta.small_n} stories; a dash: fewer than {meta.min_n}. Genres are in alphabetical order, not ranked.
                Select a genre for its full chart.
              </p>
              <p className="compare-axis" aria-hidden="true">
                Left to right: {d.variable.bins.labels[0]} → {d.variable.bins.labels[d.variable.bins.labels.length - 1]}
              </p>
              <CompareGrid
                rows={d.compareRows}
                variable={d.variable}
                minN={meta.min_n}
                onPickGenre={(id) => onChange({ ...state, mode: "one", genre: id })}
              />
              <div className="compare-notes">
                {d.ageNotes
                  .filter((n) => n.kind === "total")
                  .map((n) => (
                    <div className="agebox" key={n.kind}>
                      <p>
                        <b>{n.lead}</b> {n.text}
                      </p>
                      {RATE_FOR[d.metric.id] && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => onChange({ ...state, metric: RATE_FOR[d.metric.id] })}
                        >
                          Switch to {meta.metrics.find((m) => m.id === RATE_FOR[d.metric.id])?.label.toLowerCase()}
                        </button>
                      )}
                    </div>
                  ))}
                <p className="association">{ASSOCIATION_NOTE}</p>
              </div>
              <div className="chart-actions">
                <button
                  type="button"
                  className="btn"
                  aria-expanded={showNumbers}
                  aria-controls={numbersId}
                  onClick={() => setShowNumbers((x) => !x)}
                >
                  {showNumbers ? "Hide the numbers" : "Show the numbers"}
                </button>
                <CopyLink />
              </div>
              {showNumbers && (
                <CompareTable
                  id={numbersId}
                  rows={d.compareRows}
                  variable={d.variable}
                  metric={d.metric}
                  smallN={meta.small_n}
                  minN={meta.min_n}
                />
              )}
            </>
          ) : (
            <div className={`answer-grid${wide ? " wide" : ""}`}>
              <div className="answer-main">
                {d.oneGroup ? (
                  <div className="takeaway one-group">
                    <p>{oneGroupNote(d.oneGroup)}</p>
                    {(view.genre !== "all" || view.sub !== "all") && (
                      <p className="inline-actions">
                        {view.genre !== "all" && (
                          <button type="button" className="btn" onClick={() => onChange({ ...state, genre: "all" })}>
                            All genres
                          </button>
                        )}
                        {view.sub !== "all" && (
                          <button type="button" className="btn" onClick={() => onChange({ ...state, sub: "all" })}>
                            All stories
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  d.shownCount > 0 && (
                    <Takeaway
                      segments={d.takeaway}
                      note={d.pNote}
                      why={d.readable && !d.direction && d.effect != null}
                    />
                  )
                )}
                <RangeChart
                  key={`${d.variable.id}/${view.sub}`}
                  rows={d.rows}
                  overall={d.overall}
                  metric={d.metric}
                  variable={d.variable}
                  smallN={meta.small_n}
                  minN={meta.min_n}
                  title={d.title}
                  n={d.gd?.n}
                />
                <NumbersTable
                  id={numbersId}
                  rows={d.rows}
                  overall={d.overall}
                  metric={d.metric}
                  minN={meta.min_n}
                  visible={showNumbers}
                  caption={`The numbers behind the chart: ${d.title}`}
                />
              </div>
              <ChartNotes
                meta={meta}
                d={d}
                view={view}
                wide={wide}
                onChange={onChange}
                ageCheckOpen={ageCheckOpen}
              />
              <div className="chart-actions">
                <button
                  type="button"
                  className="btn"
                  aria-expanded={showNumbers}
                  aria-controls={numbersId}
                  onClick={() => setShowNumbers((x) => !x)}
                >
                  {showNumbers ? "Hide the numbers" : "Show the numbers"}
                </button>
                <CopyLink />
                <button type="button" className="btn primary" onClick={() => onChange({ ...state, mode: "compare", check: undefined })}>
                  Compare all {genreCount} genres →
                </button>
              </div>
            </div>
          )}
          {ageCheckOpen && <AgeCheck meta={meta} view={view} d={d} onClose={() => onChange({ ...state, check: undefined })} />}
          {next.length > 0 && (
            <nav className="next-questions" aria-label="Next questions">
              <h3>Next questions</h3>
              <ul>
                {next.map((q) => (
                  <li key={q.key}>
                    <a href={toHash("explore", q.state)}>
                      {q.prefix && <span className="muted">{q.prefix}</span>}
                      {q.text} →
                    </a>
                  </li>
                ))}
              </ul>
              <p className="next-patterns">
                <a href={toHash("patterns", { genre: view.genre, metric: view.metric })}>
                  Every clear pattern with {d.metric.noun}
                  {view.genre === "all" ? " across all genres" : ` in ${d.genre.name}`} →
                </a>
              </p>
            </nav>
          )}
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
