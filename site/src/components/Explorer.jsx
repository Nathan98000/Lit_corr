import { useEffect, useId, useState } from "react";
import { cellStats, groupRows, loadVariable, pattern } from "../lib/data.js";
import { chartValueText } from "../lib/rangeLayout.js";
import {
  RATE_FOR,
  announcement,
  answerHeading,
  chartTitle,
  oneGroupNote,
  patternNote,
  standsOutQuestion,
  subtitle,
  subtitleParts,
  takeawaySegments,
  theMeasure,
  totalsNote,
} from "../lib/wording.js";
import { sanitize, toHash } from "../lib/urlState.js";
import ChartNotes from "./ChartNotes.jsx";
import Controls, { preloadMenus } from "./Controls.jsx";
import DownloadPng from "./DownloadPng.jsx";
import { whenIdle } from "./lazyPart.jsx";
import LoadError from "./LoadError.jsx";
import { GenresPage, PatternBrowser } from "./pages.js";
import RangeChart from "./RangeChart.jsx";
import useMediaQuery from "./useMediaQuery.js";
import WayAcross from "./WayAcross.jsx";

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
  // The settings the visible chart describes: today's genre and measure, with the file's characteristic and "only
  // include" option (they differ from today's only while the next file is loading).
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
  const gd = data?.g?.[genre.id];
  const rows = groupRows(variable, gd, k);
  const overall = cellStats(gd?.o, k);
  const [direction, effect] = pattern(gd, k);
  const title = chartTitle({ variable, metric, genre, direction });
  const sub = subtitleParts({ genre, subset, n: gd?.n });
  const readable = variable.bins.ordered || Boolean(variable.yes_subject);
  const shownRows = rows.filter((r) => r.stats && !r.stats.suppressed);
  const shownCount = shownRows.length;
  const pNote = patternNote({ variable, direction, effect, shown: shownCount, smallN: meta.small_n });
  const valueText = chartValueText(rows, overall, metric.format);
  const answer = answerHeading({ variable, metric, genre, direction, effect, shown: shownCount });
  const takeaway = shownCount < 2 ? null : takeawaySegments({ variable, rows, valueText });
  const oneGroup = shownCount === 1 ? shownRows[0] : null;
  return {
    variable,
    k,
    metric,
    genre,
    subset,
    gd,
    rows,
    overall,
    direction,
    effect,
    title,
    sub,
    totalsNote: totalsNote(metric),
    readable,
    pNote,
    answer,
    takeaway,
    oneGroup,
    shownCount,
  };
}

/** "Download image"'s file name: the view's ids, in lower case. */
export const exploreFileName = (view) => `explore-${view.v}-${view.metric}-${view.genre}-${view.sub}.png`.toLowerCase();

/**
 * What "Download image" draws for this view (the owner's decision 9): the chart's full title, then the answer heading
 * when it says something else (the pair screen readers hear), the line under the heading as text, and the panel's
 * chart with its key, read from the page.
 */
export function exploreImage(d, view, panel) {
  const chart = panel?.querySelector(".range-chart");
  return {
    title: [d.title, d.answer !== d.title && d.answer],
    subtitle: [subtitle({ genre: d.genre, subset: d.subset, n: d.gd?.n })],
    chart,
    legend: chart?.querySelector(".legend"),
    fileName: exploreFileName(view),
  };
}

const TEND_TO = toHash("methodology", { section: "tend-to" });

/**
 * The takeaway line: plain text with the numbers in bold, then how clear the pattern is; the strength word links to
 * what weak, moderate and strong mean (F44).
 */
function Takeaway({ segments, note, why }) {
  return (
    <p className="takeaway">
      {segments &&
        segments.map((seg, i) => (typeof seg === "string" ? seg : <strong key={i}>{seg.strong}</strong>))}{" "}
      {note && (
        <span className="takeaway-note">
          {note.map((seg, i) =>
            typeof seg === "string" ? (
              seg
            ) : (
              <a key={i} href={TEND_TO}>
                {seg.strength}
              </a>
            ),
          )}
        </span>
      )}
      {why && (
        <>
          {" "}
          <a className="why" href={TEND_TO}>
            Why no clear pattern?
          </a>
        </>
      )}
    </p>
  );
}

/** Do two settings show the same view? */
const sameView = (a, b) => a.genre === b.genre && a.metric === b.metric && a.v === b.v && a.sub === b.sub;

/**
 * "Keep exploring" (concept J2 of the second review): the first three example questions, in their fixed order, that
 * open a view other than the one shown and other than the totals box's "Switch to …". Never chosen or ordered by a
 * result. Returns [{ question, state }].
 */
export function keepExploring(meta, view) {
  const rate = RATE_FOR[view.metric];
  const avoid = [view, rate && meta.metrics.some((m) => m.id === rate) ? { ...view, metric: rate } : null].filter(Boolean);
  return meta.featured
    .map((q) => ({
      question: q.question,
      state: sanitize({ genre: q.genre || "all", metric: q.metric, v: q.var, sub: "all" }, meta),
    }))
    .filter(({ state }) => !avoid.some((a) => sameView(a, state)))
    .slice(0, 3);
}

/**
 * The Genres page's question for this view when a genre is chosen: what stands out about its stories ("One genre",
 * with this option). { text, hash }, or null with All genres: the characteristic itself is one link away under the
 * chart ("By genre →", round 4's I15).
 */
export function genresQuestion(meta, view, d) {
  const { genre } = d;
  if (genre.id === "all") return null;
  return { text: standsOutQuestion(genre), hash: toHash("genres", { view: "genre", genre: genre.id, sub: view.sub }) };
}

/**
 * One list after the chart: every clear pattern with this measure, what stands out about the chosen genre's stories,
 * then three example questions (the characteristic on the Genres and Trends pages is under the chart, I15). A no-break
 * space keeps each "→" with its last word.
 */
function KeepExploring({ meta, view, d, onAsk }) {
  const headingId = useId();
  const { genre } = d;
  const genres = genresQuestion(meta, view, d);
  const preloadGenres = () => GenresPage.preload();
  const plainClick = (e) => !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
  return (
    <nav className="keep-exploring" aria-labelledby={headingId}>
      <h3 id={headingId}>Keep exploring</h3>
      <ul>
        <li>
          <a
            href={toHash("patterns", { genre: genre.id, metric: view.metric })}
            onPointerEnter={PatternBrowser.preload}
            onFocus={PatternBrowser.preload}
          >
            Every clear pattern with {theMeasure(d.metric)}
            {genre.id === "all" ? " across all genres" : ` in ${genre.name}`}
            {"\u00a0→"}
          </a>
        </li>
        {genres && (
          <li>
            <a href={genres.hash} onPointerEnter={preloadGenres} onFocus={preloadGenres}>
              {genres.text}
              {"\u00a0→"}
            </a>
          </li>
        )}
        {keepExploring(meta, view).map(({ question, state }) => (
          <li key={question}>
            <a
              href={toHash("explore", state)}
              onClick={(e) => {
                if (!plainClick(e)) return;
                e.preventDefault();
                onAsk(state);
              }}
            >
              {question}
              {"\u00a0→"}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Explorer({ meta, state, onChange, onAsk, onHoldScroll }) {
  const { view, data, busy, error, retry } = useShownData(state);
  const d = view ? describeView(meta, view, data) : null;
  const wide = useMediaQuery("(min-width: 900px)");

  useEffect(() => {
    if (d && !busy) document.title = d.title;
  }, [d?.title, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // once the first chart is on screen, fetch the picker's and the measure menu's code while the browser is idle
  const ready = Boolean(d && !busy);
  useEffect(() => (ready ? whenIdle(preloadMenus) : undefined), [ready]);

  // a new measure or characteristic, from the sentence or the totals box's "Switch to …", keeps the scroll position even
  // when the new chart is shorter (round 3)
  const keepPlace = (next) => {
    onHoldScroll?.();
    onChange(next);
  };
  // ways out of a selection that leaves one group or none: back to All genres or All stories (only those that change
  // something)
  const wayOut = view && (view.genre !== "all" || view.sub !== "all") && (
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
  );

  return (
    <section className="explorer" id="explore" aria-label="Explorer">
      <Controls meta={meta} state={state} onChange={keepPlace} />
      <p className="visually-hidden" aria-live="polite">
        {!busy && d ? announcement(d.title, d.answer) : ""}
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
            <p className="chart-sub">
              {d.sub.lead}
              {d.sub.count && (
                <>
                  {" · "}
                  <a href={toHash("methodology", { section: "missing-data" })}>{d.sub.count}</a>
                </>
              )}
            </p>
          </header>
          <div className={`answer-grid${wide ? " wide" : ""}`}>
            <div className="answer-main">
              {d.oneGroup ? (
                <div className="takeaway one-group">
                  <p>{oneGroupNote(d.oneGroup)}</p>
                  {wayOut}
                </div>
              ) : (
                d.shownCount > 0 &&
                (d.takeaway || d.pNote) && (
                  <Takeaway
                    segments={d.takeaway}
                    note={d.pNote}
                    why={d.readable && !d.direction && d.effect != null}
                  />
                )
              )}
              <RangeChart
                key={`${d.variable.id}/${view.sub}/${view.metric}`}
                rows={d.rows}
                overall={d.overall}
                metric={d.metric}
                variable={d.variable}
                smallN={meta.small_n}
                minN={meta.min_n}
                title={d.title}
                n={d.gd?.n}
                emptyActions={wayOut}
              />
              <WayAcross meta={meta} page="explore" variable={d.variable} genre={view.genre} sub={view.sub} />
            </div>
            <ChartNotes meta={meta} d={d} view={view} wide={wide} onChange={keepPlace} />
            {d.shownCount > 0 && (
              <div className="chart-actions">
                <DownloadPng busy={busy} image={(panel) => exploreImage(d, view, panel)} />
              </div>
            )}
          </div>
          <KeepExploring meta={meta} view={view} d={d} onAsk={onAsk} />
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
