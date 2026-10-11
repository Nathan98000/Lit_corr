import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Explorer, { ChartPlaceholder } from "./components/Explorer.jsx";
import { PartBoundary } from "./components/lazyPart.jsx";
import LoadError from "./components/LoadError.jsx";
import { GenresPage, Methodology, PatternBrowser } from "./components/pages.js";
import useScrollFloor from "./components/useScrollFloor.js";
import { clearCache, loadMeta, prefetchGenres } from "./lib/data.js";
import { scrollBehavior } from "./lib/motion.js";
import { parseHash, sanitize, sanitizeGenres, settledHash, toHash } from "./lib/urlState.js";
import { aboutCount } from "./lib/wording.js";

const PAGE_PLACEHOLDER = <div className="page-placeholder" aria-busy="true" />;

export const TITLE = "What do popular Literotica stories have in common?";
export const GENRES_TITLE = "How do the genres’ stories differ?";
export const SITE_NAME = "Story Patterns"; // the masthead name: change it here
const PAGE_TITLES = {
  methodology: `How it works · ${TITLE}`,
  patterns: `Patterns · ${TITLE}`,
  genres: GENRES_TITLE, // while the page or its file loads; then the question on screen (GenresPage, F73)
};
const DEFAULT_QUESTION = "In All genres, how does the average rating vary with story length in words?";

/**
 * The headline as a kicker, with the story and genre counts (filled in when the data arrives; the placeholder says
 * the same). The story count is rounded, so it never contradicts a chart's exact count (F55). The Genres page asks
 * its own question.
 */
function Kicker({ meta, title = TITLE }) {
  return (
    <h1 className="kicker">
      {title}{" "}
      <span className="kicker-counts">
        · {meta ? aboutCount(meta.counts.included) : "about 9,000"} stories · {meta ? meta.genres.length - 1 : 30} genres
      </span>
    </h1>
  );
}

/** The Genres page's place while its code or its file is on its way: the question, then a chart-sized frame. */
export function GenresPlaceholder() {
  return (
    <div className="genres-page" aria-busy="true">
      <div className="controls">
        <p className="sentence sentence-placeholder" aria-hidden="true">
          {"\u00a0"}
        </p>
        <div className="genres-controls" aria-hidden="true" />
      </div>
      <ChartPlaceholder />
    </div>
  );
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(() => {
    const first = parseHash(window.location.hash);
    // a visit that starts on the Genres page fetches the page's code and its file at once, not after meta.json (F68)
    if (first.page === "genres") {
      GenresPage.preload();
      prefetchGenres(first.state.sub || "all");
    }
    return first;
  });
  const lastExplore = useRef(route.page === "explore" ? route.state : {});
  const lastGenres = useRef(null); // the last Genres address of this visit (the masthead's link goes back to it)
  const lastChart = useRef({}); // the Genres page's last characteristic and order, for the way back from one genre
  const chosenGenre = useRef(null); // the last genre the reader chose in this visit, on any page (D8)
  const mainRef = useRef(null);
  const [floorRef, holdScroll] = useScrollFloor();

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
    document.documentElement.dataset.page = route.page; // page-specific scroll padding (styles.css)
    if (!route.section) window.scrollTo?.(0, 0);
  }, [route.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = useMemo(() => (meta ? sanitize(route.state, meta) : null), [meta, route.state]);
  useEffect(() => {
    if (route.page === "explore" && state) {
      lastExplore.current = state;
      if (state.genre !== "all") chosenGenre.current = state.genre;
    }
  }, [route.page, state]);

  // the Genres page: one genre keeps the characteristic it came from, for the way back
  const genresState = useMemo(() => {
    if (!meta || route.page !== "genres") return null;
    const raw = route.state.view === "genre" ? { ...lastChart.current, ...route.state } : route.state;
    return sanitizeGenres(raw, meta, chosenGenre.current);
  }, [meta, route.page, route.state]);
  useEffect(() => {
    if (!genresState) return;
    lastGenres.current = genresState;
    if (genresState.genre) chosenGenre.current = genresState.genre;
    if (genresState.view !== "genre") lastChart.current = { v: genresState.v, sort: genresState.sort };
  }, [genresState]);

  // an old link's setting that the page no longer has leaves the address, in place (no new history entry)
  useEffect(() => {
    const shown = route.page === "explore" ? state : route.page === "genres" ? genresState : null;
    const settled = shown && settledHash(window.location.hash, route.page, shown);
    if (settled) window.history.replaceState(null, "", settled);
  }, [route.page, state, genresState]);
  // a control (characteristic, option, order) replaces the address; another view adds one, so Back returns
  const updateGenres = useCallback((next) => {
    window.history.replaceState(null, "", toHash("genres", next));
    setRoute({ page: "genres", state: next });
  }, []);
  // a link to another view (from a chart's details or a row) also moves focus to the new question
  const goGenres = useCallback((next, { focus = false } = {}) => {
    window.history.pushState(null, "", toHash("genres", next));
    setRoute({ page: "genres", state: next });
    window.scrollTo?.(0, 0);
    if (focus) {
      const later = window.requestAnimationFrame || ((f) => setTimeout(f, 0));
      later(() => document.getElementById("question")?.focus({ preventScroll: true }));
    }
  }, []);
  const genresLink = lastGenres.current ? toHash("genres", lastGenres.current) : "#/genres";
  const preloadGenres = () => {
    GenresPage.preload();
    prefetchGenres(lastGenres.current?.sub || "all");
  };

  const updatePatterns = useCallback((next) => {
    window.history.replaceState(null, "", toHash("patterns", next));
    setRoute({ page: "patterns", state: next });
  }, []);

  const update = useCallback((next) => {
    window.history.replaceState(null, "", toHash("explore", next));
    setRoute({ page: "explore", state: next });
  }, []);

  // an example question opens as a new entry in the history, and the page goes back up to the question sentence
  const ask = (next) => {
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
    const asks = route.page === "explore" || route.page === "genres";
    const target = (asks && document.getElementById("question")) || mainRef.current;
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
              href={genresLink}
              aria-current={route.page === "genres" ? "page" : undefined}
              onPointerEnter={preloadGenres}
              onFocus={preloadGenres}
            >
              Genres
            </a>
            <a
              href={toHash("patterns", { genre: lastExplore.current.genre, metric: lastExplore.current.metric })}
              aria-current={route.page === "patterns" ? "page" : undefined}
              onPointerEnter={PatternBrowser.preload}
              onFocus={PatternBrowser.preload}
            >
              Patterns
            </a>
            <a
              className="nav-how"
              href="#/methodology"
              aria-current={route.page === "methodology" ? "page" : undefined}
              onPointerEnter={Methodology.preload}
              onFocus={Methodology.preload}
            >
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
          meta ? (
            <PartBoundary fallback={PAGE_PLACEHOLDER}>
              <Methodology meta={meta} section={route.section} />
            </PartBoundary>
          ) : (
            PAGE_PLACEHOLDER
          )
        ) : route.page === "genres" ? (
          <>
            <div className="intro">
              <Kicker meta={meta} title={GENRES_TITLE} />
            </div>
            {meta ? (
              <PartBoundary fallback={<GenresPlaceholder />}>
                <GenresPage
                  meta={meta}
                  state={genresState}
                  onChange={updateGenres}
                  onNavigate={goGenres}
                  onHoldScroll={holdScroll}
                  chosenGenre={chosenGenre}
                  lastChart={lastChart}
                  lastExplore={lastExplore.current}
                />
              </PartBoundary>
            ) : (
              <GenresPlaceholder />
            )}
          </>
        ) : route.page === "patterns" ? (
          meta ? (
            <PartBoundary fallback={PAGE_PLACEHOLDER}>
              <PatternBrowser meta={meta} state={sanitize(route.state, meta)} onChange={updatePatterns} />
            </PartBoundary>
          ) : (
            PAGE_PLACEHOLDER
          )
        ) : (
          <>
            <div className="intro">
              <Kicker meta={meta} />
            </div>
            {meta ? (
              <Explorer meta={meta} state={state} onChange={update} onAsk={ask} onHoldScroll={holdScroll} />
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
      {/* keeps the scroll position when the sentence's new question makes the page shorter (useScrollFloor.js) */}
      {(route.page === "explore" || route.page === "genres") && (
        <div ref={floorRef} className="scroll-floor" aria-hidden="true" />
      )}

      <footer className="site-footer">
        <div className="wrap">
          <p>
            An independent project, not affiliated with or endorsed by Literotica.{" "}
            <a href="#/methodology" onPointerEnter={Methodology.preload} onFocus={Methodology.preload}>
              How it works
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
