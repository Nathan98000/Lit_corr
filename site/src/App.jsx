import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Explorer, { ChartPlaceholder } from "./components/Explorer.jsx";
import LoadError from "./components/LoadError.jsx";
import Methodology from "./components/Methodology.jsx";
import { clearCache, loadMeta } from "./lib/data.js";
import { scrollBehavior } from "./lib/motion.js";
import { formatCount, formatDate } from "./lib/format.js";
import { parseHash, sanitize, toHash } from "./lib/urlState.js";

const TITLE = "What do popular Literotica stories have in common?";

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
    document.title = route.page === "methodology" ? `Methodology · ${TITLE}` : TITLE;
    window.scrollTo?.(0, 0);
  }, [route.page]);

  const state = useMemo(() => (meta ? sanitize(route.state, meta) : null), [meta, route.state]);
  useEffect(() => {
    if (route.page === "explore" && state) lastExplore.current = state;
  }, [route.page, state]);

  const update = useCallback((next) => {
    window.history.replaceState(null, "", toHash("explore", next));
    setRoute({ page: "explore", state: next });
  }, []);

  const ask = (q) => {
    const next = sanitize({ mode: q.mode || "one", genre: q.genre || "all", metric: q.metric, v: q.var, sub: "all" }, meta);
    window.history.pushState(null, "", toHash("explore", next));
    setRoute({ page: "explore", state: next });
    const later = window.requestAnimationFrame || ((f) => setTimeout(f, 0));
    later(() => document.getElementById("explore")?.scrollIntoView?.({ behavior: scrollBehavior() }));
  };

  const skip = (e) => {
    e.preventDefault();
    mainRef.current?.focus();
  };

  const genreCount = meta ? meta.genres.length - 1 : 0;
  return (
    <div className="site">
      <a className="skip-link" href="#/explore" onClick={skip}>
        Skip to content
      </a>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <a className="brand" href={toHash("explore", lastExplore.current)}>
            Story popularity <span>· an explorer</span>
          </a>
          <nav aria-label="Pages">
            <a href={toHash("explore", lastExplore.current)} aria-current={route.page === "explore" ? "page" : undefined}>
              Explore
            </a>
            <a href="#/methodology" aria-current={route.page === "methodology" ? "page" : undefined}>
              Methodology
            </a>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="wrap">
        {error ? (
          <LoadError onRetry={retry} detail={error} />
        ) : route.page === "methodology" ? (
          meta ? <Methodology meta={meta} /> : <div className="page-placeholder" aria-busy="true" />
        ) : (
          <>
            <section className="hero">
              <h1>{TITLE}</h1>
              <p className="lede">
                Choose a genre, a way of measuring popularity and a story characteristic to see how they go together
                across {meta ? formatCount(meta.counts.included) : "about 9,000"} stories from{" "}
                {meta ? genreCount : 30} of Literotica’s genres.
              </p>
              {meta && (
                <div className="featured" aria-label="Example questions">
                  <span className="featured-label">Try</span>
                  {meta.featured.map((q) => (
                    <button type="button" key={q.question} className="chip" onClick={() => ask(q)}>
                      {q.question}
                    </button>
                  ))}
                </div>
              )}
            </section>
            {meta ? <Explorer meta={meta} state={state} onChange={update} /> : <ChartPlaceholder />}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p>
            The visualizations show descriptive associations in stories on Literotica. They do not establish
            causation, and the stories and users represented on Literotica should not be assumed to represent all
            erotic fiction, readers, or human sexuality.
          </p>
          {meta && (
            <p className="muted">
              Based on a random sample of {formatCount(meta.counts.included)} stories collected{" "}
              {formatDate(meta.source.collected_from)} – {formatDate(meta.source.collected_to)}. This site holds
              summaries of groups of stories only: no story text, titles, authors or story-by-story records. An
              independent project, not affiliated with or endorsed by Literotica. <a href="#/methodology">How it works</a>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
