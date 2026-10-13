import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Explorer, { ChartPlaceholder } from "./components/Explorer.jsx";
import { PartBoundary } from "./components/lazyPart.jsx";
import LoadError from "./components/LoadError.jsx";
import { GenresPage, Methodology, PatternBrowser, TrendsPage } from "./components/pages.js";
import SiteNav from "./components/SiteNav.jsx";
import useScrollFloor from "./components/useScrollFloor.js";
import { clearCache, loadMeta, prefetchGenres, prefetchTrends } from "./lib/data.js";
import { scrollBehavior } from "./lib/motion.js";
import { parseHash, sanitize, sanitizeGenres, sanitizeTrends, settledHash, toHash, trendsChanges } from "./lib/urlState.js";
import { aboutCount } from "./lib/wording.js";

const PAGE_PLACEHOLDER = <div className="page-placeholder" aria-busy="true" />;

export const TITLE = "What do popular Literotica stories have in common?";
export const GENRES_TITLE = "How do the genres’ stories differ?";
export const TRENDS_TITLE = "How have the stories changed?";
export const SITE_NAME = "Story Patterns"; // the masthead name: change it here
const PAGE_TITLES = {
  methodology: `How it works · ${TITLE}`,
  patterns: `Patterns · ${TITLE}`,
  genres: GENRES_TITLE, // while the page or its file loads; then the question on screen (GenresPage, F73)
  trends: TRENDS_TITLE, // the same (TrendsPage)
};
const DEFAULT_QUESTION = "In all genres, how does the average rating vary with word count?";

// The masthead's pages, in its order (D7): Patterns is a part of Popularity (the Popularity page links to it), and on a
// phone every page is in the masthead's menu (SiteNav.jsx; the owner, 2026-10-13)
export const NAV = ["explore", "genres", "trends", "methodology"];
export const PAGE_NAMES = {
  explore: "Popularity",
  genres: "Genres",
  trends: "Trends",
  patterns: "Patterns",
  methodology: "How it works",
};

/**
 * A new address in place (a control's change; an old link's setting dropped): no new history entry, and the entry's
 * state stays, with what "One genre" keeps there (its open topics and lists, GenreProfile.jsx); a new entry
 * (pushState) starts empty.
 */
const replaceHash = (hash) => window.history.replaceState(window.history.state, "", hash);

/**
 * The kicker, with the story and genre counts (filled in when the data arrives; the placeholder says the same). The
 * story count is rounded, so it never contradicts a chart's exact count (F55). On Explore it is the site's headline,
 * the page's h1; on the other pages (round 4's U1) it names the page and the source, a paragraph over the question,
 * which is the h1 there: "Genres · about 9,000 Literotica stories · 30 genres", and the Trends page's years instead of
 * the genres (meta.trend; until the data arrives, figure spaces hold their place). When it wraps, the counts take a
 * line of their own, and a "·" never starts or ends a line: each separator leads its piece, and one at a line's start
 * is clipped (styles.css); the pieces ("about 9,000 Literotica stories", "2000–2026") never break inside.
 */
function Kicker({ meta, page = null, years = false }) {
  const stories = meta ? aboutCount(meta.counts.included) : "about 9,000";
  const span = meta?.trend ? `${meta.trend.periods[0][0]}–${meta.trend.now[1]}` : "\u2007\u2007\u2007\u2007–\u2007\u2007\u2007\u2007";
  const Tag = page ? "p" : "h1";
  return (
    <Tag className="kicker">
      <span className="kicker-title">{page || TITLE}</span>
      <span className="kicker-counts">
        <span className="kicker-sep"> · </span>
        <span className="kicker-pieces">
          <span className="kicker-piece">{page ? `${stories} Literotica stories` : `${stories} stories`}</span>
          <span className="kicker-piece">
            <span className="kicker-sep"> · </span>
            {years ? span : `${meta ? meta.genres.length - 1 : 30} genres`}
          </span>
        </span>
      </span>
    </Tag>
  );
}

/**
 * The Genres page's place while its code or its file is on its way: the question, then a chart-sized frame (the
 * Trends page's too).
 */
export function GenresPlaceholder({ className = "genres-page" }) {
  return (
    <div className={className} aria-busy="true">
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
    // a visit that starts on the Genres page fetches the page's code and its file at once, not after meta.json (F68),
    // and one that starts on the Trends page its code and the file of its option and genre
    if (first.page === "genres") {
      GenresPage.preload();
      prefetchGenres(first.state.sub || "all");
    }
    if (first.page === "trends") {
      TrendsPage.preload();
      prefetchTrends(first.state.sub || "all", first.state.genre || "all");
    }
    return first;
  });
  const lastExplore = useRef(route.page === "explore" ? route.state : {});
  const lastGenres = useRef(null); // the last Genres address of this visit (the masthead's link goes back to it)
  const lastChart = useRef({}); // the Genres page's last characteristic and order, for the way back from one genre
  const chosenGenre = useRef(null); // the last genre the reader chose in this visit, on any page (D8)
  const lastTrends = useRef(null); // the last Trends address of this visit (the masthead's link goes back to it)
  const lastTrendChart = useRef({}); // the Trends page's last characteristic, for the way back from what changed
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

  // the Trends page: it opens on what changed (O4), which keeps the characteristic it came from, for the way back; it
  // opens on All genres (D9), and a genre chosen there counts as chosen for the Genres page (D8)
  const trendsState = useMemo(() => {
    if (!meta || route.page !== "trends") return null;
    const raw = trendsChanges(route.state) ? { ...lastTrendChart.current, ...route.state, view: "changes" } : route.state;
    return sanitizeTrends(raw, meta);
  }, [meta, route.page, route.state]);
  useEffect(() => {
    if (!trendsState) return;
    lastTrends.current = trendsState;
    if (trendsState.genre !== "all") chosenGenre.current = trendsState.genre;
    if (trendsState.view !== "changes") lastTrendChart.current = { v: trendsState.v };
  }, [trendsState]);

  // an old link's setting that the page no longer has leaves the address, in place (no new history entry)
  useEffect(() => {
    const shown = route.page === "explore" ? state : route.page === "genres" ? genresState : null;
    const settled = shown && settledHash(window.location.hash, route.page, shown);
    if (settled) replaceHash(settled);
  }, [route.page, state, genresState]);
  // a control (characteristic, option, order) replaces the address; another view adds one, so Back returns
  const updateGenres = useCallback((next) => {
    replaceHash(toHash("genres", next));
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

  const updateTrends = useCallback((next) => {
    replaceHash(toHash("trends", next));
    setRoute({ page: "trends", state: next });
  }, []);
  const goTrends = useCallback((next, { focus = false } = {}) => {
    window.history.pushState(null, "", toHash("trends", next));
    setRoute({ page: "trends", state: next });
    window.scrollTo?.(0, 0);
    if (focus) {
      const later = window.requestAnimationFrame || ((f) => setTimeout(f, 0));
      later(() => document.getElementById("question")?.focus({ preventScroll: true }));
    }
  }, []);
  // the masthead's link: the last Trends address of this visit (on the page, the one shown), else the page's own (what
  // changed in All genres, D9 and O4); hovering or focusing it fetches the page's code and that address's file
  const shownTrends = trendsState || lastTrends.current;
  const trendsLink = shownTrends ? toHash("trends", shownTrends) : "#/trends";
  const preloadTrends = () => {
    TrendsPage.preload();
    prefetchTrends(lastTrends.current?.sub || "all", lastTrends.current?.genre || "all");
  };

  const updatePatterns = useCallback((next) => {
    replaceHash(toHash("patterns", next));
    setRoute({ page: "patterns", state: next });
  }, []);

  const update = useCallback((next) => {
    replaceHash(toHash("explore", next));
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
    const asks = route.page === "explore" || route.page === "genres" || route.page === "trends";
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
          <SiteNav
            here={PAGE_NAMES[route.page] || PAGE_NAMES.explore}
            links={[
              {
                id: "explore",
                label: PAGE_NAMES.explore,
                href: toHash("explore", lastExplore.current),
                current: route.page === "explore" ? "page" : route.page === "patterns" ? "section" : null,
              },
              {
                id: "genres",
                label: PAGE_NAMES.genres,
                href: genresLink,
                current: route.page === "genres" ? "page" : null,
                preload: preloadGenres,
              },
              {
                id: "trends",
                label: PAGE_NAMES.trends,
                href: trendsLink,
                current: route.page === "trends" ? "page" : null,
                preload: preloadTrends,
              },
              {
                id: "how",
                label: PAGE_NAMES.methodology,
                href: "#/methodology",
                current: route.page === "methodology" ? "page" : null,
                preload: Methodology.preload,
              },
            ]}
          />
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
              <Kicker meta={meta} page="Genres" />
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
        ) : route.page === "trends" ? (
          <>
            <div className="intro">
              <Kicker meta={meta} page="Trends" years />
            </div>
            {meta ? (
              <PartBoundary fallback={<GenresPlaceholder className="trends-page" />}>
                <TrendsPage
                  meta={meta}
                  state={trendsState}
                  onChange={updateTrends}
                  onNavigate={goTrends}
                  onHoldScroll={holdScroll}
                  lastChart={lastTrendChart}
                  lastExplore={lastExplore.current}
                />
              </PartBoundary>
            ) : (
              <GenresPlaceholder className="trends-page" />
            )}
          </>
        ) : route.page === "patterns" ? (
          <>
            {/* the page opens as the others do (round 4's X2): the kicker names the page and the source */}
            <div className="intro">
              <Kicker meta={meta} page="Patterns" />
            </div>
            {meta ? (
              <PartBoundary fallback={PAGE_PLACEHOLDER}>
                <PatternBrowser meta={meta} state={sanitize(route.state, meta)} onChange={updatePatterns} />
              </PartBoundary>
            ) : (
              PAGE_PLACEHOLDER
            )}
          </>
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
      {(route.page === "explore" || route.page === "genres" || route.page === "trends") && (
        <div ref={floorRef} className="scroll-floor" aria-hidden="true" />
      )}

      <footer className="site-footer">
        <div className="wrap">
          <p>An independent project, not affiliated with or endorsed by Literotica.</p>
        </div>
      </footer>
    </div>
  );
}
