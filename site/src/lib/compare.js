// Comparing genres (concept D2 of the design review, with D1 as the numbers): each group's median relative to its own
// genre's median. Genres stay in alphabetical order (All genres first); nothing is ranked by a result.

import { cellStats, pattern, relativeMedian } from "./data.js";
import { formatCount, formatRatio } from "./format.js";

/** The verdict for one genre, in words, or null for characteristics that are not read as a trend. */
export function verdict(variable, direction, effect) {
  if (!(variable.bins.ordered || variable.yes_subject)) return null;
  if (effect == null) return { kind: "few", text: "too few stories to judge", arrow: "" };
  if (direction > 0) return { kind: "up", text: "tends higher", arrow: "↗" };
  if (direction < 0) return { kind: "down", text: "tends lower", arrow: "↘" };
  return { kind: "flat", text: "no clear pattern", arrow: "" };
}

/** One row per genre, in the order of meta.genres (All genres first, then alphabetical). */
export function compareRows({ meta, variable, varData, k, smallN }) {
  return meta.genres.map((genre) => {
    const gd = varData?.g?.[genre.id];
    const overall = cellStats(gd?.o, k);
    const [direction, effect] = pattern(gd, k);
    const cells = variable.bins.labels.map((label, i) => {
      const stats = cellStats(gd?.b?.[i], k);
      const ratio = relativeMedian(stats, overall);
      const shown = ratio != null;
      return { label, stats, ratio, hidden: !shown, small: shown && stats.n < smallN };
    });
    return { genre, gd, overall, cells, direction, effect, verdict: verdict(variable, direction, effect) };
  });
}

/**
 * The summary over the genres (not All genres): "Tends higher in 18 of 30 genres, tends lower in none, no clear
 * pattern in 12." Counts only: no genre names, no ordering by result.
 */
export function compareSummary(rows) {
  const genres = rows.filter((r) => r.genre.id !== "all" && r.verdict);
  if (!genres.length) return null;
  const count = (kind) => genres.filter((r) => r.verdict.kind === kind).length;
  const n = genres.length;
  const say = (x) => (x ? String(x) : "none");
  const up = count("up");
  let text = `Tends higher in ${up ? up : "none"} of ${n} genres, tends lower in ${say(count("down"))}, ` +
    `no clear pattern in ${say(count("flat"))}`;
  if (count("few")) text += `, too few stories to judge in ${count("few")}`;
  return `${text}.`;
}

/** The accessible name of a genre card: its verdict and each group's ratio. */
export function cardLabel(row, minN) {
  const parts = row.cells.map((c) =>
    c.hidden ? `${c.label}: fewer than ${minN} stories` : `${c.label} ${formatRatio(c.ratio)}${c.small ? " (few stories)" : ""}`,
  );
  return `${row.genre.name}${row.verdict ? `: ${row.verdict.text}` : ""}. ${parts.join(", ")}. Open its chart.`;
}

const LIM = 1; // the mini chart's scale: log2 clamped to ±1, i.e. 0.5× to 2×

/** Geometry of one mini chart: x per group, y per ratio on a log scale clamped to 0.5×–2×. */
export function sparkGeometry(cells, width, height = 56, padX = 10) {
  const n = cells.length;
  const y = (r) => 4 + ((LIM - Math.max(-LIM, Math.min(LIM, Math.log2(r)))) / (2 * LIM)) * (height - 8);
  const xs = cells.map((_, i) => padX + (n === 1 ? (width - 2 * padX) / 2 : (i / (n - 1)) * (width - 2 * padX)));
  return {
    width,
    height,
    band: [y(1.5), y(1 / 1.5)],
    one: y(1),
    points: cells.map((c, i) => ({ x: xs[i], y: c.hidden ? y(1) : y(c.ratio), ...c })),
  };
}

/** Columns of genre cards for a width: 2 below 420 px, 3 below 700, 4 below 1,000, then 5. */
export function gridColumns(width) {
  return width < 420 ? 2 : width < 700 ? 3 : width < 1000 ? 4 : 5;
}

/** D1's stepped fills: nothing between 0.91× and 1.1×, and nothing at all for groups under 30 stories. */
export function stepFill(ratio, small) {
  if (ratio == null || small) return null;
  if (ratio >= 1.5) return "#8fb4f4";
  if (ratio >= 1.25) return "#bcd3fa";
  if (ratio >= 1.1) return "#e1ebfd";
  if (ratio <= 0.67) return "#eea877";
  if (ratio <= 0.8) return "#f6cfb1";
  if (ratio <= 0.91) return "#fbe7d7";
  return null;
}

/** "Romance, Under 2,000: median 0.31 (24 stories), against 0.45 for all Romance stories shown." */
export function cellDetail(row, cell, fmt, minN) {
  if (cell.hidden) return `${row.genre.name}, ${cell.label}: fewer than ${minN} stories, not shown.`;
  return (
    `${row.genre.name}, ${cell.label}: median ${fmt(cell.stats.median)} (${formatCount(cell.stats.n)} ` +
    `stories), against ${fmt(row.overall.median)} for all ${row.genre.id === "all" ? "" : `${row.genre.name} `}` +
    "stories shown."
  );
}
