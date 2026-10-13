import { useEffect, useId, useState } from "react";
import { decodePattern, loadPatterns } from "../lib/data.js";
import { toHash } from "../lib/urlState.js";
import { chartTitle, genreWords, theMeasure } from "../lib/wording.js";
import InlineSelect from "./InlineSelect.jsx";
import LoadError from "./LoadError.jsx";

const readsAsTrend = (v) => v.bins.ordered || Boolean(v.yes_subject);
const byLabel = (a, b) => a.variable.label.localeCompare(b.variable.label, "en");
const TEND_TO = toHash("methodology", { section: "tend-to" });

/** Everything the page says, from meta and patterns.json only (no medians, no counts of stories). */
export function patternSummary(meta, patterns, genreId, metricId) {
  const k = meta.metrics.findIndex((m) => m.id === metricId);
  const codes = patterns.g[genreId]?.[k] || "";
  const items = meta.variables.map((variable, i) => ({ variable, pattern: decodePattern(patterns.key, codes[i]) }));
  const trend = items.filter((x) => readsAsTrend(x.variable));
  const clear = trend.filter((x) => x.pattern && x.pattern.direction !== 0);
  const topics = meta.topics
    .map((t) => ({
      topic: t,
      clear: clear.filter((x) => x.variable.topic === t.id).sort(byLabel),
      other: trend.filter((x) => x.variable.topic === t.id && !clear.includes(x)).sort(byLabel),
    }))
    .filter((t) => t.clear.length || t.other.length);
  return { trend: trend.length, clear: clear.length, topics };
}

/** One characteristic with a clear pattern: its name (linking to its chart), the direction and the strength. */
function ClearRow({ variable, pattern, metric, genre, link }) {
  const id = useId();
  const up = pattern.direction > 0;
  return (
    <li className="pattern-row">
      <a href={link(variable)} aria-describedby={id}>
        {variable.label}
      </a>
      <span id={id} className="visually-hidden">
        {chartTitle({ variable, metric, genre, direction: pattern.direction })}
      </span>
      <span className={`pattern-dir ${up ? "up" : "down"}`}>
        <span aria-hidden="true">{up ? "↗" : "↘"} </span>
        {up ? "tends higher" : "tends lower"}
      </span>
      <span className="pattern-strength">{pattern.strength}</span>
    </li>
  );
}

/**
 * The pattern browser (idea I4, laid out as concept G2 of the second review): for a genre and a measure, the eight
 * topics folded, each with its count of clear patterns; inside, one compact row per characteristic with a clear
 * pattern, alphabetical. Never sorted by strength, effect or direction; the count of those without a clear pattern
 * is always given, and the toggle lists them too.
 */
export default function PatternBrowser({ meta, state, onChange }) {
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const ids = useId();
  useEffect(() => {
    let live = true;
    setError(null);
    loadPatterns().then(
      (p) => live && setPatterns(p),
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const genre = meta.genres.find((g) => g.id === state.genre);
  const metric = meta.metrics.find((m) => m.id === state.metric);
  const where = genre.id === "all" ? "across all genres" : `in ${genre.name}`;
  const s = patterns ? patternSummary(meta, patterns, genre.id, metric.id) : null;
  const link = (v) => toHash("explore", { genre: genre.id, metric: metric.id, v: v.id, sub: "all" });
  // a topic folds open when it has something to list: its clear patterns, or (with the toggle) the others
  const opens = (t) => t.clear.length > 0 || (showAll && t.other.length > 0);
  const openable = s ? s.topics.filter(opens) : [];
  const allOpen = openable.length > 0 && openable.every((t) => open.has(t.topic.id));
  const setTopic = (id, isOpen) =>
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  // the page's question is its h1 (round 4's X2), named by its words as the other pages' are; the kicker names the page
  const asked = `Clear patterns in ${genreWords(genre)} with ${theMeasure(metric)}`;
  return (
    <article className="patterns-page">
      <span id={`${ids}-question`} hidden>
        {asked}
      </span>
      <h1 className="sentence patterns-question" aria-labelledby={`${ids}-question`}>
        Clear patterns in{" "}
        <InlineSelect id={`${ids}-g`} label="Genre" value={genre.id} text={genreWords(genre)} onChange={(g) => onChange({ ...state, genre: g })}>
          {meta.genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </InlineSelect>{" "}
        with {metric.plural ? "" : "the "}
        <InlineSelect
          id={`${ids}-m`}
          label="Popularity measure"
          value={metric.id}
          text={metric.noun}
          onChange={(m) => onChange({ ...state, metric: m })}
        >
          {meta.metric_groups.map((grp) => (
            <optgroup key={grp} label={grp}>
              {meta.metrics
                .filter((m) => m.group === grp)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </InlineSelect>
      </h1>

      {error ? (
        <LoadError onRetry={() => setAttempt((a) => a + 1)} detail={error} />
      ) : !s ? (
        <div className="ph-chart" aria-busy="true" />
      ) : (
        <>
          <p className="takeaway pattern-count">
            <strong>{s.clear}</strong> of {s.trend} characteristics have a clear pattern with {theMeasure(metric)} {where}. The
            other {s.trend - s.clear} show no clear pattern.
          </p>
          <div className="pattern-buttons">
            <button type="button" className="btn" aria-pressed={showAll} onClick={() => setShowAll((x) => !x)}>
              Show the ones with no clear pattern too
            </button>
            {openable.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(allOpen ? new Set() : new Set(openable.map((t) => t.topic.id)))}
              >
                {allOpen ? "Close all topics" : "Open all topics"}
              </button>
            )}
          </div>
          <p className="pattern-key">
            ↗ tends higher: the more of the characteristic, the higher the median {metric.noun} (for yes/no
            characteristics: higher in stories that have it). ↘ tends lower: the opposite.{" "}
            <a href={TEND_TO}>What weak, moderate and strong mean</a>
          </p>
          <div className="pattern-topics">
            {s.topics.map((t) => {
              const { topic, clear, other } = t;
              const total = clear.length + other.length;
              const head = (
                <>
                  <h2 className="pattern-topic-name">{topic.label}</h2>
                  <span className="pattern-topic-count">
                    {" · "}
                    {clear.length} of {total} clear
                  </span>
                </>
              );
              if (!opens(t)) {
                // nothing to list until "Show the ones with no clear pattern too" is on: the topic and its count only
                return (
                  <div key={topic.id} className="pattern-topic is-empty">
                    <div className="pattern-topic-head">{head}</div>
                  </div>
                );
              }
              return (
                <details
                  key={topic.id}
                  className="pattern-topic"
                  open={open.has(topic.id)}
                  onToggle={(e) => setTopic(topic.id, e.currentTarget.open)}
                >
                  <summary className="pattern-topic-head">{head}</summary>
                  <ul className="pattern-rows">
                    {clear.map(({ variable, pattern }) => (
                      <ClearRow key={variable.id} variable={variable} pattern={pattern} metric={metric} genre={genre} link={link} />
                    ))}
                    {showAll &&
                      other.map(({ variable, pattern }) => (
                        <li key={variable.id} className="pattern-row no-pattern">
                          <a href={link(variable)}>{variable.label}</a>
                          <span className="pattern-verdict">{pattern ? "no clear pattern" : "too few stories to judge"}</span>
                        </li>
                      ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
