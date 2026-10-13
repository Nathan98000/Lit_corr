// The explorer's settings live in the address (e.g. #/explore?genre=adult-romance&metric=pop_views&var=story_words),
// so any view can be bookmarked or shared.

export const DEFAULT_STATE = {
  genre: "all",
  metric: "pop_rating", // the average rating, also meta.default_metric (litcorr/stage2/wording.py)
  v: "story_words",
  sub: "all",
};

const PARAMS = { genre: "genre", metric: "metric", v: "var", sub: "include" };
const PATTERN_PARAMS = { genre: "genre", metric: "metric" };
// the Genres page: one characteristic in every genre (#/genres?var=…&include=…&sort=value), or one genre against all
// genres (#/genres?view=genre&genre=…&include=…)
const GENRE_PARAMS = { view: "view", v: "var", genre: "genre", sub: "include", sort: "sort" };
const GENRE_CHART_ORDER = ["v", "sub", "sort"];
const GENRE_PROFILE_ORDER = ["view", "genre", "sub"];
// the Trends page: what changed in a genre's stories, its default (#/trends, #/trends?genre=…&include=…), or one
// characteristic over time (#/trends?var=…&genre=…&include=…); the trends page build's View 2 addresses
// (#/trends?view=changes&genre=…&include=…) still open what changed, but no address is written with `view`
const TREND_PARAMS = { view: "view", v: "var", genre: "genre", sub: "include" };
const TREND_CHART_ORDER = ["v", "genre", "sub"];
const TREND_CHANGES_ORDER = ["genre", "sub"];

/**
 * Pages: #/explore?… (the explorer), #/genres?… (the Genres page), #/trends?… (the Trends page),
 * #/patterns?genre=…&metric=… (the pattern browser) and #/methodology or #/methodology/<section> (How it works).
 */
export function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  const [rawPath, query = ""] = h.split("?");
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  const read = (map) => {
    const state = {};
    for (const [key, param] of Object.entries(map)) {
      if (params.has(param)) state[key] = params.get(param);
    }
    return state;
  };
  if (parts[0] === "methodology") return { page: "methodology", section: parts[1] || null, state: {} };
  if (parts[0] === "patterns") return { page: "patterns", state: read(PATTERN_PARAMS) };
  if (parts[0] === "genres") return { page: "genres", state: read(GENRE_PARAMS) };
  if (parts[0] === "trends") return { page: "trends", state: read(TREND_PARAMS) };
  return { page: "explore", state: read(PARAMS) };
}

export function toHash(page, state = {}) {
  if (page === "methodology") return state.section ? `#/methodology/${state.section}` : "#/methodology";
  if (page === "genres") {
    const params = new URLSearchParams();
    for (const key of state.view === "genre" ? GENRE_PROFILE_ORDER : GENRE_CHART_ORDER) {
      if (state[key] != null) params.set(GENRE_PARAMS[key], state[key]);
    }
    const q = params.toString();
    return q ? `#/genres?${q}` : "#/genres";
  }
  if (page === "trends") {
    const params = new URLSearchParams();
    for (const key of state.view === "changes" ? TREND_CHANGES_ORDER : TREND_CHART_ORDER) {
      if (state[key] != null) params.set(TREND_PARAMS[key], state[key]);
    }
    const q = params.toString();
    return q ? `#/trends?${q}` : "#/trends";
  }
  const map = page === "patterns" ? PATTERN_PARAMS : PARAMS;
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(map)) {
    if (state[key] != null) params.set(param, state[key]);
  }
  const q = params.toString();
  const base = page === "patterns" ? "#/patterns" : "#/explore";
  return q ? `${base}?${q}` : base;
}

// Settings that old links carry and the pages no longer have: Explore's similar-age check (`check=age`) and mode
// (`mode=one`, or `mode=compare` for comparing genres, whose links open the chart of the genre they carry, or of All
// genres), and the highlighted genre of the Genres page's "One characteristic" (`genre`, which "One genre" keeps).
const RETIRED = ["check", "mode", "genre"];

/**
 * The address to settle on when `hash` carries a setting its page no longer has (an old link's `check=age`, `mode=one`
 * or highlighted `genre`): the page's own address for `state`; null otherwise (any other address stays as it is, even
 * one the page sanitizes).
 */
export function settledHash(hash, page, state) {
  const keys = (h) => [...new URLSearchParams((h || "").split("?")[1] || "").keys()];
  const own = toHash(page, state);
  const kept = new Set(keys(own));
  return keys(hash).some((k) => RETIRED.includes(k) && !kept.has(k)) ? own : null;
}

/** What a characteristic is called inside a sentence: its noun ("story age", not "story age (years online)"). */
const called = (variable) => variable.noun || variable.label.toLowerCase();

/**
 * "Only include" options that cannot go with a characteristic: a length option while the chart is about word
 * count, a "Published …" option while it is about publication year or story age. Returns the reason ("not with word
 * count", "not with story age"), or null.
 */
export function subsetConflict(subset, variable) {
  if (!subset || !variable) return null;
  if (subset.group === "Length" && variable.id === "story_words") return `not with ${called(variable)}`;
  if (subset.group === "Published" && (variable.id === "pub_year" || variable.id === "age_years")) {
    return `not with ${called(variable)}`;
  }
  return null;
}

/** "Options that would leave only one group of story age are turned off." (the select's description) */
export const conflictNote = (variable) => `Options that would leave only one group of ${called(variable)} are turned off.`;

const has = (list, id) => list.some((x) => x.id === id);

/** The measure a chart opens with: the data's default (the average rating), or its first measure if it has none. */
export const defaultMetric = (meta) => (has(meta.metrics, meta.default_metric) ? meta.default_metric : meta.metrics[0].id);

/** Fill in defaults and replace anything the data does not know about. */
export function sanitize(state, meta) {
  const s = { ...DEFAULT_STATE, ...state };
  if (!has(meta.genres, s.genre)) s.genre = "all";
  if (!has(meta.metrics, s.metric)) s.metric = defaultMetric(meta);
  if (!has(meta.variables, s.v)) s.v = has(meta.variables, DEFAULT_STATE.v) ? DEFAULT_STATE.v : meta.variables[0].id;
  if (!has(meta.subsets, s.sub)) s.sub = "all";
  const variable = meta.variables.find((v) => v.id === s.v);
  if (subsetConflict(meta.subsets.find((x) => x.id === s.sub), variable)) s.sub = "all";
  return s;
}

/** Characteristics left out of the Genres page (GENRE_PAGE_EXCLUDED in litcorr/stage2/wording.py). */
export const GENRE_PAGE_EXCLUDED = ["pub_month", "pub_weekday"];
export const onGenresPage = (variable) => Boolean(variable) && !GENRE_PAGE_EXCLUDED.includes(variable.id);

/** Can the genres be put in order of their values? Numbers (ranges) and yes/no characteristics, not named groups. */
export const sortable = (variable) => Boolean(variable.yes_subject) || variable.bins.type === "ranges";

/**
 * The genre "One genre" opens with (D8): the last genre the reader chose in this visit, else the genre with the most
 * stories on Literotica (meta.genres' `size`).
 */
export function defaultGenre(meta, remembered = null) {
  const genres = meta.genres.filter((g) => g.id !== "all");
  if (remembered && genres.some((g) => g.id === remembered)) return remembered;
  return genres.reduce((best, g) => ((g.size ?? -1) > (best.size ?? -1) ? g : best), genres[0]).id;
}

/**
 * The Genres page's settings: { v, sub, sort? } for one characteristic in every genre, { view: "genre", genre, sub, v }
 * for one genre (`v` is kept for the way back). An unknown characteristic, or one left out of the page, becomes story
 * length; an unknown or conflicting option, All stories; one characteristic drops any genre (the highlight is gone), and
 * one genre replaces an unknown one by the default (D8); `sort` stays only as "value" for characteristics that can be
 * put in order.
 */
export function sanitizeGenres(state, meta, remembered = null) {
  const allowed = (id) => meta.variables.find((v) => v.id === id && onGenresPage(v));
  const variable = allowed(state.v) || allowed(DEFAULT_STATE.v) || meta.variables.find(onGenresPage);
  const real = (id) => id !== "all" && has(meta.genres, id);
  const profile = state.view === "genre";
  let sub = has(meta.subsets, state.sub) ? state.sub : "all";
  if (!profile && subsetConflict(meta.subsets.find((x) => x.id === sub), variable)) sub = "all";
  if (profile) return { view: "genre", genre: real(state.genre) ? state.genre : defaultGenre(meta, remembered), sub, v: variable.id };
  const s = { v: variable.id, sub };
  if (state.sort === "value" && sortable(variable)) s.sort = "value";
  return s;
}

/** Characteristics left out of the Trends page (TREND_PAGE_EXCLUDED in litcorr/stage2/wording.py; meta.trend.excluded). */
export const TREND_PAGE_EXCLUDED = ["pub_year", "age_years", "pub_month", "pub_weekday", "pub_is_weekend", "meta_tag_count", "author_stories_count"];
export const onTrendsPage = (variable) => Boolean(variable) && !TREND_PAGE_EXCLUDED.includes(variable.id);

/**
 * The Trends page's chart of a characteristic seen with `genre` and the option `sub` elsewhere ("Over time →", round
 * 4's I15): that genre and, when the page offers it, that option, else all stories. { v, genre, sub }, or null for a
 * characteristic the page leaves out (or without meta.trend).
 */
export function overTimeState(meta, variable, genre = "all", sub = "all") {
  if (!meta.trend || !onTrendsPage(variable)) return null;
  const offered = meta.trend.subsets.includes(sub) && !subsetConflict(meta.subsets.find((s) => s.id === sub), variable);
  return { v: variable.id, genre, sub: offered ? sub : "all" };
}

/** Does a Trends address open what changed? Without a characteristic (the page's default, O4), or with `view=changes`. */
export const trendsChanges = (state) => state.view === "changes" || state.v == null;

/**
 * The Trends page's settings: { view: "changes", genre, sub, v } for what changed, the page's default (`v` is kept for
 * the way back: the remembered characteristic, else word count), { v, genre, sub } for one characteristic over time
 * (an address with `var`, unless it says `view=changes`). An unknown characteristic, or one left out of the page,
 * becomes word count; an unknown genre, All genres (the page opens on All genres, D9); an option the page doesn't
 * offer (meta.trend.subsets) All stories, and so does a Length option with word count in one characteristic's view.
 */
export function sanitizeTrends(state, meta) {
  const allowed = (id) => meta.variables.find((v) => v.id === id && onTrendsPage(v));
  const variable = allowed(state.v) || allowed(DEFAULT_STATE.v) || meta.variables.find(onTrendsPage);
  const genre = has(meta.genres, state.genre) ? state.genre : "all";
  let sub = (meta.trend?.subsets ?? ["all"]).includes(state.sub) ? state.sub : "all";
  const changes = trendsChanges(state);
  if (!changes && subsetConflict(meta.subsets.find((x) => x.id === sub), variable)) sub = "all";
  return changes ? { view: "changes", genre, sub, v: variable.id } : { v: variable.id, genre, sub };
}
