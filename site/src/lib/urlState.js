// The explorer's settings live in the address (e.g. #/explore?genre=adult-romance&metric=pop_views&var=story_words),
// so any view can be bookmarked or shared.

export const DEFAULT_STATE = {
  mode: "one",
  genre: "all",
  metric: "pop_rating", // the average rating, also meta.default_metric (litcorr/stage2/wording.py)
  v: "story_words",
  sub: "all",
};

const PARAMS = { mode: "mode", genre: "genre", metric: "metric", v: "var", sub: "include", check: "check" };
const PATTERN_PARAMS = { genre: "genre", metric: "metric" };
// the Genres page: one characteristic in every genre (#/genres?var=…&include=…&genre=…&sort=value, the genre being the
// highlighted one), or one genre against all genres (#/genres?view=genre&genre=…&include=…)
const GENRE_PARAMS = { view: "view", v: "var", genre: "genre", sub: "include", sort: "sort" };
const GENRE_CHART_ORDER = ["v", "sub", "genre", "sort"];
const GENRE_PROFILE_ORDER = ["view", "genre", "sub"];

/**
 * Pages: #/explore?… (the explorer), #/genres?… (the Genres page), #/patterns?genre=…&metric=… (the pattern browser)
 * and #/methodology or #/methodology/<section> (How it works).
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
  const map = page === "patterns" ? PATTERN_PARAMS : PARAMS;
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(map)) {
    if (state[key] != null) params.set(param, state[key]);
  }
  const q = params.toString();
  const base = page === "patterns" ? "#/patterns" : "#/explore";
  return q ? `${base}?${q}` : base;
}

/**
 * "Only include" options that cannot go with a characteristic: a length option while the chart is about word
 * count, a "Published …" option while it is about publication year or years online. Returns the reason, or null.
 */
export function subsetConflict(subset, variable) {
  if (!subset || !variable) return null;
  if (subset.group === "Length" && variable.id === "story_words") return "not with word count";
  if (subset.group === "Published" && (variable.id === "pub_year" || variable.id === "age_years")) {
    return `not with ${variable.label.toLowerCase()}`;
  }
  return null;
}

const has = (list, id) => list.some((x) => x.id === id);

/** The measure a chart opens with: the data's default (the average rating), or its first measure if it has none. */
export const defaultMetric = (meta) => (has(meta.metrics, meta.default_metric) ? meta.default_metric : meta.metrics[0].id);

/** Fill in defaults and replace anything the data does not know about. */
export function sanitize(state, meta) {
  const s = { ...DEFAULT_STATE, ...state };
  if (s.mode !== "one" && s.mode !== "compare") s.mode = DEFAULT_STATE.mode;
  if (!has(meta.genres, s.genre)) s.genre = "all";
  if (!has(meta.metrics, s.metric)) s.metric = defaultMetric(meta);
  if (!has(meta.variables, s.v)) s.v = has(meta.variables, DEFAULT_STATE.v) ? DEFAULT_STATE.v : meta.variables[0].id;
  if (!has(meta.subsets, s.sub)) s.sub = "all";
  const variable = meta.variables.find((v) => v.id === s.v);
  if (subsetConflict(meta.subsets.find((x) => x.id === s.sub), variable)) s.sub = "all";
  if (s.check !== "age" || s.mode !== "one" || s.sub !== "all") delete s.check;
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
 * The Genres page's settings: { v, sub, genre?, sort? } for one characteristic in every genre (`genre` is the
 * highlighted one), { view: "genre", genre, sub, v } for one genre (`v` is kept for the way back). An unknown
 * characteristic, or one left out of the page, becomes story length; an unknown or conflicting option, All stories; an
 * unknown genre is dropped, or for one genre replaced by the default (D8); `sort` stays only as "value" for
 * characteristics that can be put in order.
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
  if (real(state.genre)) s.genre = state.genre;
  if (state.sort === "value" && sortable(variable)) s.sort = "value";
  return s;
}
