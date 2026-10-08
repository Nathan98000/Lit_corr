// The explorer's settings live in the address (e.g. #/explore?genre=adult-romance&metric=pop_views&var=story_words),
// so any view can be bookmarked or shared.

export const DEFAULT_STATE = {
  mode: "one",
  genre: "all",
  metric: "pop_fav_per_1k_views",
  v: "story_words",
  sub: "all",
};

const PARAMS = { mode: "mode", genre: "genre", metric: "metric", v: "var", sub: "include" };

export function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  const [path, query = ""] = h.split("?");
  const page = path.replace(/^\/+/, "") === "methodology" ? "methodology" : "explore";
  const params = new URLSearchParams(query);
  const state = {};
  for (const [key, param] of Object.entries(PARAMS)) {
    if (params.has(param)) state[key] = params.get(param);
  }
  return { page, state };
}

export function toHash(page, state = {}) {
  if (page === "methodology") return "#/methodology";
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(PARAMS)) {
    if (state[key] != null) params.set(param, state[key]);
  }
  const q = params.toString();
  return q ? `#/explore?${q}` : "#/explore";
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
  return s;
}
