import { useEffect, useId, useState } from "react";
import { decodePattern, loadPatterns } from "../lib/data.js";
import { toHash } from "../lib/urlState.js";
import { chartTitle } from "../lib/wording.js";
import InlineSelect from "./InlineSelect.jsx";
import LoadError from "./LoadError.jsx";

const readsAsTrend = (v) => v.bins.ordered || Boolean(v.yes_subject);
const byLabel = (a, b) => a.variable.label.localeCompare(b.variable.label, "en");

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
  return { trend: trend.length, clear: clear.length, unordered: items.length - trend.length, topics };
}

/**
 * The pattern browser (idea I4): for a genre and a measure, every characteristic with a clear pattern, grouped by
 * topic in the topics' order and alphabetical within each topic. Never sorted by strength; the count of those
 * without a clear pattern is always given.
 */
export default function PatternBrowser({ meta, state, onChange }) {
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
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
  const link = (v) => toHash("explore", { mode: "one", genre: genre.id, metric: metric.id, v: v.id, sub: "all" });

  return (
    <article className="patterns-page">
      <h1>Patterns</h1>
      <p className="sentence patterns-question">
        Clear patterns in{" "}
        <InlineSelect id={`${ids}-g`} label="Genre" value={genre.id} text={genre.name} onChange={(g) => onChange({ ...state, genre: g })}>
          {meta.genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </InlineSelect>{" "}
        with{" "}
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
      </p>

      {error ? (
        <LoadError onRetry={() => setAttempt((a) => a + 1)} detail={error} />
      ) : !s ? (
        <div className="ph-chart" aria-busy="true" />
      ) : (
        <>
          <p className="pattern-count">
            <strong>{s.clear}</strong> of {s.trend} characteristics that can show a trend have a clear pattern with{" "}
            {metric.noun} {where}. The other {s.trend - s.clear} don’t, which is just as informative.
          </p>
          <p className="pattern-count muted">
            {s.unordered} characteristics have no order (such as month) and are not summed up as a trend.
          </p>
          <p className="pattern-note">
            With this many characteristics, some differences appear by chance; the rule behind “tend to” allows for
            that.{" "}
            <a href={toHash("methodology", { section: "tend-to" })}>When a title says “tend to”</a>
          </p>
          <button type="button" className="btn" aria-pressed={showAll} onClick={() => setShowAll((x) => !x)}>
            Show the ones with no clear pattern too
          </button>
          {s.topics
            .filter((t) => t.clear.length || showAll)
            .map(({ topic, clear, other }) => (
              <section key={topic.id} className="pattern-topic" aria-labelledby={`${ids}-${topic.id}`}>
                <h2 id={`${ids}-${topic.id}`}>{topic.label}</h2>
                <ul>
                  {clear.map(({ variable, pattern }) => (
                    <li key={variable.id}>
                      <span className="pattern-name">{variable.label}</span>
                      <a href={link(variable)}>{chartTitle({ variable, metric, genre, direction: pattern.direction })}</a>{" "}
                      <span className={`strength ${pattern.direction > 0 ? "up" : "down"}`}>{pattern.strength}</span>
                    </li>
                  ))}
                  {showAll &&
                    other.map(({ variable, pattern }) => (
                      <li key={variable.id} className="no-pattern">
                        <a href={link(variable)}>{variable.label}</a>{" "}
                        <span className="muted">{pattern ? "no clear pattern" : "too few stories to judge"}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </>
      )}
    </article>
  );
}
