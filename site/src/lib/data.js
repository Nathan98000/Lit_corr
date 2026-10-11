// Loading the precomputed aggregates (site/public/aggregates/, written by `python -m litcorr site-data`)
// and reading their compact format.
//
// v/<characteristic>/<included>.json holds, for every genre id (and "all"):
//   n  number of stories with this characteristic
//   b  one cell per group of stories (null when the group has too few stories to show)
//   o  the same summary for all of those stories together
//   p  per popularity measure: [direction, effect]; direction is +1 / -1 when the pattern is clear enough to
//      say "tend to", 0 otherwise; effect is a rank correlation (null when not computed)
// A cell is [n, medianAgeYears, m0, m1, ...] with one entry per popularity measure (meta.metrics order; the site no
// longer shows the median age):
//   [median, p25, p75, mean] or [median, p25, p75, mean, nWithThisMeasure], or null if too few stories.

const BASE = import.meta.env.BASE_URL || "./";
const cache = new Map();

export function aggregatesUrl(path) {
  return `${BASE}aggregates/${path}`;
}

function getJson(path) {
  if (!cache.has(path)) {
    const p = fetch(aggregatesUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status})`);
        return r.json();
      })
      .catch((e) => {
        cache.delete(path);
        throw e;
      });
    cache.set(path, p);
  }
  return cache.get(path);
}

export const loadMeta = () => getJson("meta.json");
export const loadVariable = (variable, subset) => getJson(`v/${variable}/${subset}.json`);
export const clearCache = () => cache.clear();
export const loadPatterns = () => getJson("patterns.json");

/**
 * genres/<included>.json, the Genres page's file for one "Only include" option: `genres` (meta.genres' order), each
 * genre's stories `n` and median `age` (not shown), and per characteristic `c[id]`: its form `k` (num, zero, bin, grp, band),
 * `fmt` for numbers (num, percent, year), per genre `q` (num: [n, p25, median, p75], all genres [n, p10, p25, median,
 * p75, p90]; bin: [n, share]; grp and band: [n, share per group]; zero: [n]), for zero `z` (stories above 0, then for
 * all genres their share, then their quartiles), `r` (rank-biserial r, or for grp the total variation distance,
 * against all genres) and `f` (+1 clearly higher, -1 clearly lower, 1 a different mix, 0 neither). null: fewer than
 * meta.min_n stories.
 */
export const loadGenres = (subset) => getJson(`genres/${subset}.json`);
export function prefetchGenres(subset = "all") {
  loadGenres(subset).catch(() => {});
}

/**
 * One characteristic's entry in patterns.json: { direction, strength } ("weak" | "moderate" | "strong"), or null
 * when the pattern was not computed. The file's key lists the codes in order: -1, 0, +1, each weak/moderate/strong.
 */
export function decodePattern(key, code) {
  const i = key.indexOf(code);
  if (i < 0 || i >= 9) return null;
  return { direction: Math.floor(i / 3) - 1, strength: ["weak", "moderate", "strong"][i % 3] };
}

/** Has this file already been fetched (or is it on its way)? */
export const isCached = (variable, subset) => cache.has(`v/${variable}/${subset}.json`);

/** Start fetching a file the visitor is likely to open next (e.g. a characteristic they hover); errors are ignored. */
export function prefetchVariable(variable, subset) {
  if (!variable || !subset) return;
  loadVariable(variable, subset).catch(() => {});
}

/** Summary of one popularity measure in one cell, or null if the group is not shown. */
export function cellStats(cell, k) {
  if (!cell) return null;
  const m = cell[2 + k];
  if (!m) return { n: cell[0], suppressed: true };
  return {
    n: m.length > 4 ? m[4] : cell[0],
    median: m[0],
    p25: m[1],
    p75: m[2],
    mean: m[3],
  };
}

/** One row per group of stories for a genre: { index, label, stats } (stats null when hidden). */
export function groupRows(variable, genreData, k) {
  return variable.bins.labels.map((label, index) => ({
    index,
    label,
    stats: genreData ? cellStats(genreData.b[index], k) : null,
  }));
}

/** The pattern summary [direction, effect] for a genre and measure. */
export function pattern(genreData, k) {
  return genreData?.p?.[k] ?? [0, null];
}

/**
 * trends/<included>/<genre>.json, the Trends page's file for one "Only include" option (meta.trend.subsets) and genre:
 * `periods` (five-year periods of publication year, the last one from 2020 to the newest story), the windows compared
 * (`then`, `now`: the last period), `rule`, the stories per period `n`, and per characteristic `c[id]`: its form `k`
 * (num, zero, bin, grp, band), `fmt` for numbers, per period `q` and for the "then" window `t` (num: [n, p25, median,
 * p75]; bin: [n, share]; zero: [n, stories above 0, (all genres only: their share), p25, median, p75 among them]; grp
 * and band: [n, share per group]; null under meta.min_n stories), `r` (now against then: rank-biserial r, or for grp the
 * total variation distance; null when a window has fewer than the rule's stories) and `f` (+1 clearly rose, -1 clearly
 * fell, 1 a different mix, 0 neither); all.json also `rm`, `fm`: the same with each genre's share held fixed.
 */
export const loadTrends = (subset, genre) => getJson(`trends/${subset}/${genre}.json`);
export function prefetchTrends(subset = "all", genre = "all") {
  loadTrends(subset, genre).catch(() => {});
}
