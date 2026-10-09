import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Explorer, { ChartPlaceholder } from "./components/Explorer.jsx";
import LoadError from "./components/LoadError.jsx";
import Methodology from "./components/Methodology.jsx";
import PatternBrowser from "./components/PatternBrowser.jsx";
import { clearCache, loadMeta } from "./lib/data.js";
import { scrollBehavior } from "./lib/motion.js";
import { formatCount } from "./lib/format.js";
import { parseHash, sanitize, toHash } from "./lib/urlState.js";

export const TITLE = "What do popular Literotica stories have in common?";
export const SITE_NAME = "Story Patterns"; // the masthead name: change it here
const PAGE_TITLES = { methodology: `How it works · ${TITLE}`, patterns: `Patterns · ${TITLE}` };
const DEFAULT_QUESTION = "In All genres, how do favorites per 1,000 views vary with story length?";

/** The headline as a kicker, with the story and genre counts (filled in when the data arrives). */
function Kicker({ meta }) {
  return (
    <h1 className="kicker">
      {TITLE}{" "}
      <span className="kicker-counts">
        · {meta ? formatCount(meta.counts.included) : "8,996"} stories · {meta ? meta.genres.length - 1 : 30} genres
      </span>
    </h1>
  );
}

/** Example questions under the chart: a row that scrolls sideways on phones and wraps on wider screens. */
function TryAnother({ meta, onAsk }) {
  return (
    <section className="try-another" aria-labelledby="try-title">
      <h2 id="try-title">Try another question</h2>
      <ul className="chips-row">
        {meta.featured.map((q) => (
          <li key={q.question}>
            <button type="button" className="chip" onClick={() => onAsk(q)}>
              {q.question}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const lastExplore = useRef(route.page === "explore" ? route.state : {});
  const mainRef = useRef(null);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError(null);
    loadMeta().then(setMeta, (e) => setError(e.message));
  }, [attempt]);
  const retry = () => {
    clearCache();
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = PAGE_TITLES[route.page] || TITLE;
    if (!route.section) window.scrollTo?.(0, 0);
  }, [route.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = useMemo(() => (meta ? sanitize(route.state, meta) : null), [meta, route.state]);
  useEffect(() => {
    if (route.page === "explore" && state) lastExplore.current = state;
  }, [route.page, state]);

  const updatePatterns = useCallback((next) => {
    window.history.replaceState(null, "", toHash("patterns", next));
    setRoute({ page: "patterns", state: next });
  }, []);

  const update = useCallback((next) => {
    window.history.replaceState(null, "", toHash("explore", next));
    setRoute({ page: "explore", state: next });
  }, []);

  const ask = (q) => {
    const next = sanitize({ mode: q.mode || "one", genre: q.genre || "all", metric: q.metric, v: q.var, sub: "all" }, meta);
    window.history.pushState(null, "", toHash("explore", next));
    setRoute({ page: "explore", state: next });
    const later = window.requestAnimationFrame || ((f) => setTimeout(f, 0));
    later(() => {
      const q = document.getElementById("question");
      q?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
      q?.focus({ preventScroll: true });
    });
  };

  // The skip link goes to the question sentence (or to the page's content elsewhere).
  const skip = (e) => {
    e.preventDefault();
    const target = (route.page === "explore" && document.getElementById("question")) || mainRef.current;
    target?.focus();
    target?.scrollIntoView?.({ block: "start" });
  };

  return (
    <div className="site">
      <header className="masthead">
        <a className="skip-link" href="#/explore" onClick={skip}>
          Skip to content
        </a>
        <div className="wrap masthead-inner">
          <a className="brand" href={toHash("explore", lastExplore.current)}>
            {SITE_NAME}
          </a>
          <nav aria-label="Pages">
            <a
              className="nav-explore"
              href={toHash("explore", lastExplore.current)}
              aria-current={route.page === "explore" ? "page" : undefined}
            >
              Explore
            </a>
            <a
              href={toHash("patterns", { genre: lastExplore.current.genre, metric: lastExplore.current.metric })}
              aria-current={route.page === "patterns" ? "page" : undefined}
            >
              Patterns
            </a>
            <a href="#/methodology" aria-current={route.page === "methodology" ? "page" : undefined}>
              How it works
            </a>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="wrap">
        {error ? (
          <>
            <div className="intro">
              <Kicker meta={null} />
            </div>
            <LoadError onRetry={retry} detail={error} />
          </>
        ) : route.page === "methodology" ? (
          meta ? <Methodology meta={meta} section={route.section} /> : <div className="page-placeholder" aria-busy="true" />
        ) : route.page === "patterns" ? (
          meta ? (
            <PatternBrowser meta={meta} state={sanitize(route.state, meta)} onChange={updatePatterns} />
          ) : (
            <div className="page-placeholder" aria-busy="true" />
          )
        ) : (
          <>
            <div className="intro">
              <Kicker meta={meta} />
            </div>
            {meta ? (
              <>
                <Explorer meta={meta} state={state} onChange={update} />
                <TryAnother meta={meta} onAsk={ask} />
              </>
            ) : (
              <div className="explorer" aria-busy="true">
                <div className="controls">
                  <p className="sentence sentence-placeholder" aria-hidden="true">
                    {Object.keys(route.state).length ? "\u00a0" : DEFAULT_QUESTION}
                  </p>
                  <div className="question-after" aria-hidden="true">
                    <span className="include">Only include: All stories</span>
                  </div>
                </div>
                <ChartPlaceholder />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            An independent project, not affiliated with or endorsed by Literotica. This site holds summaries of groups
            of stories only: no story text, titles, authors or story-by-story records.{" "}
            <a href="#/methodology">How it works</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
