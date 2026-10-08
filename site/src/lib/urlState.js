// The explorer's settings live in the address (e.g. #/explore?genre=adult-romance&metric=pop_views&var=story_words),
// so any view can be bookmarked or shared.

export const DEFAULT_STATE = {
  mode: "one",
  genre: "all",
  metric: "pop_fav_per_1k_views",
  v: "story_words",
  sub: "all",
};

const PARAMS = { mode: "mode", genre: "genre", metric: "metric", v: "var", sub: "include", check: "check" };
const PATTERN_PARAMS = { genre: "genre", metric: "metric" };

/**
 * Pages: #/explore?… (the explorer), #/patterns?genre=…&metric=… (the pattern browser) and
 * #/methodology or #/methodology/<section> (How it works).
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
  return { page: "explore", state: read(PARAMS) };
}

export function toHash(page, state = {}) {
  if (page === "methodology") return state.section ? `#/methodology/${state.section}` : "#/methodology";
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

/** Fill in defaults and replace anything the data does not know about. */
export function sanitize(state, meta) {
  const has = (list, id) => list.some((x) => x.id === id);
  const s = { ...DEFAULT_STATE, ...state };
  if (s.mode !== "one" && s.mode !== "compare") s.mode = DEFAULT_STATE.mode;
  if (!has(meta.genres, s.genre)) s.genre = "all";
  if (!has(meta.metrics, s.metric)) s.metric = has(meta.metrics, meta.default_metric) ? meta.default_metric : meta.metrics[0].id;
  if (!has(meta.variables, s.v)) s.v = has(meta.variables, DEFAULT_STATE.v) ? DEFAULT_STATE.v : meta.variables[0].id;
  if (!has(meta.subsets, s.sub)) s.sub = "all";
  const variable = meta.variables.find((v) => v.id === s.v);
  if (subsetConflict(meta.subsets.find((x) => x.id === s.sub), variable)) s.sub = "all";
  if (s.check !== "age" || s.mode !== "one" || s.sub !== "all") delete s.check;
  return s;
}
