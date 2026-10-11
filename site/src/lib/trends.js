// The Trends page (STAGE2_TRENDS_PAGE_PROMPT.md, docs/stage2/TRENDS_PAGE_PROPOSAL.md): reading the trends/<included>/
// <genre>.json files (data.js) and every sentence of the page. The years come from the file or meta.trend, never from
// here; a characteristic "clearly" changed only through the file's flags (`f`, and `fm` for the fixed-mix line).

import { formatCount, formatFixed } from "./format.js";
import { mixColors } from "./genreLayout.js";
import { fileDecimals, formatPercent, plainUnit, withUnit } from "./genres.js";
import { trendDomain, trendTicks } from "./trendLayout.js";
import { lowerFirst, upperFirst } from "./wording.js";

/**
 * View 1's question, in parts around its two slots: "In [All genres], how has [story length in words] changed over
 * time?"; for yes/no characteristics the share of its stories: "…, how has the share of [stories with an author's note]
 * changed over time?".
 */
export function trendQuestion(variable) {
  if (variable.yes_subject) {
    return { before: "In ", middle: ", how has the share of ", slot: lowerFirst(variable.yes_subject), after: " changed over time" };
  }
  return { before: "In ", middle: ", how has ", slot: variable.noun, after: " changed over time" };
}

export function trendQuestionText(variable, genre) {
  const q = trendQuestion(variable);
  return `${q.before}${genre.name}${q.middle}${q.slot}${q.after}?`;
}

/** View 2's question: "What has changed in stories in All genres?" */
export const changesQuestion = (genre) => `What has changed in stories in ${genre.name}?`;

// ------------------------------------------------------------------------------------------------ reading the file
/** The two windows' words, from the file or meta.trend: { then: "2000–2009", now: "2020 or later" }. */
export const windowWords = (t) => ({ then: `${t.then[0]}–${t.then[1]}`, now: `${t.now[0]} or later` });

/**
 * One period's (or the "then" window's) cell as numbers, or null under MIN_N stories: num { n, p25, median, p75 }; bin
 * { n, share }; zero { n, any (stories above 0), share (All genres: weighted; a genre: any / n), p25, median, p75
 * among those, when shown }; grp and band { n, shares }; each with `small` under `smallN` stories.
 */
export function trendCell(kind, cell, all, smallN) {
  if (!cell) return null;
  const n = cell[0];
  const small = n < smallN;
  if (kind === "num") return { n, p25: cell[1], median: cell[2], p75: cell[3], small };
  if (kind === "bin") return { n, share: cell[1], small };
  if (kind === "zero") {
    const any = cell[1];
    const share = all ? cell[2] : n ? any / n : 0;
    const q = cell.slice(all ? 3 : 2);
    return { n, any, share, small, ...(q.length === 3 ? { p25: q[0], median: q[1], p75: q[2] } : {}) };
  }
  return { n, shares: cell.slice(1), small };
}

/** Every period's cell, and the "then" window's, as numbers (trendCell). */
export const trendCells = (entry, all, smallN) => entry.q.map((c) => trendCell(entry.k, c, all, smallN));

/** Does the characteristic have fewer than MIN_N stories in every period (nothing to draw)? */
export const nothingToDraw = (entry) => entry.q.every((c) => c == null);

// ---------------------------------------------------------------------------------------------- numbers and units
const twoDigits = (v) => {
  const r = Number(v.toPrecision(2));
  return formatFixed(r, Math.max(0, 1 - Math.floor(Math.log10(Math.abs(r)))));
};
const significantDigits = (text) => text.replace(/[^0-9]/g, "").replace(/^0+/, "").length;

/** A share with `d` decimals, never "0%" above 0 (one decimal, then "<0.1%"). */
function percentText(v, d) {
  if (v == null || !Number.isFinite(v)) return "–";
  const p = v * 100;
  if (v === 0 || Number(p.toFixed(d)) !== 0) return `${formatFixed(p, d)}%`;
  return d === 0 ? formatPercent(v) : p > 0 ? "<0.1%" : ">−0.1%";
}

/**
 * How one characteristic's chart prints its numbers (the Genres page's F66 rule, on the chart's own numbers): numbers
 * take the most decimals among every period's quartiles as the file writes them, but no more than the chart's largest
 * quartile needs for three significant digits (a quartile of 0.993 beside a median of 63.6 doesn't print "63.600"), at
 * most 3, with two significant digits for a value those decimals would round away; percentages are whole, with one
 * decimal when the chart's largest median is under 10%; shares as formatPercent writes them, or all with one decimal
 * when the chart's largest share is under 10%. Returns { value(v), span(lo, hi), unit, withUnit(v), share(v) }.
 */
export function trendFormat(variable, entry, all, smallN = 30) {
  const fmt = entry.fmt || "num";
  const cells = [...entry.q, entry.t].map((c) => trendCell(entry.k, c, all, smallN)).filter(Boolean);
  const medians = cells.map((c) => c.median).filter((v) => v != null);
  const quartiles = cells.filter((c) => c.median != null).flatMap((c) => [c.p25, c.median, c.p75]);
  const top = medians.length ? Math.max(...medians.map(Math.abs)) : 0;
  const largest = Math.max(0, ...quartiles.map(Math.abs));
  const threeDigits = largest > 0 ? Math.max(0, 2 - Math.floor(Math.log10(largest))) : 0;
  const d = fmt === "percent" ? (top < 0.1 ? 1 : 0) : Math.min(3, threeDigits, Math.max(0, ...quartiles.map(fileDecimals)));
  const value = (v) => {
    if (v == null || !Number.isFinite(v)) return "–";
    if (fmt === "year") return String(Math.round(v));
    if (fmt === "percent") return percentText(v, d);
    const text = formatFixed(v, d);
    if (v === 0) return text;
    const rounded = Number(v.toFixed(d));
    const lost = Math.abs(rounded - v) > 1e-9 * Math.max(1, Math.abs(v));
    return lost && (rounded === 0 || significantDigits(text) < 2) ? twoDigits(v) : text;
  };
  const shares = cells.map((c) => c.share).filter((v) => v != null);
  const sd = shares.length && Math.max(...shares) < 0.1 ? 1 : 0;
  const unit = plainUnit(variable, fmt);
  return {
    fmt,
    decimals: d,
    value,
    span: (lo, hi) => `${value(lo)}${lo < 0 || hi < 0 ? " to " : "–"}${value(hi)}`,
    unit,
    withUnit: (v) => withUnit(value(v), unit),
    // shares as everywhere on the site (formatPercent: whole, one decimal under 1%), or all with one decimal when the
    // chart's largest share is under 10%
    share: (v) => (sd ? percentText(v, 1) : formatPercent(v)),
  };
}

/**
 * The words after a yes/no characteristic's share, from its subject: "with an author’s note" (Stories with an author’s
 * note), "first-person" (First-person stories), "later parts of a series" (Later parts of a series).
 */
export function yesPhrase(variable) {
  const s = variable.yes_subject || "";
  return /^Stories /.test(s) ? s.slice("Stories ".length) : lowerFirst(s).replace(/ stories$/, "");
}

/** The chart's axis title: the label, with its unit when it is a rate; yes/no characteristics, "…, share of stories". */
export function trendAxisTitle(variable, entry) {
  if (entry.k === "bin") return `${variable.yes_subject}, share of stories`;
  const unit = variable.unit || "";
  return /^per /.test(unit) && entry.fmt !== "percent" ? `${variable.label}, ${unit}` : variable.label;
}

// --------------------------------------------------------------------------------------------------------- headings
/** What a heading or a sentence calls the characteristic: its noun, or for yes/no ones "the share of …". */
export const trendNoun = (variable) => (variable.yes_subject ? `the share of ${lowerFirst(variable.yes_subject)}` : variable.noun);

/** "clearly rose", "clearly fell", "clearly moved later" (bands), "clearly changed" (named groups), from a flag. */
function changeWords(kind, f) {
  if (kind === "grp") return "changed";
  if (kind === "band") return f > 0 ? "moved later" : "moved earlier";
  return f > 0 ? "rose" : "fell";
}

/**
 * The too-few sentence: "Fewer than 30 stories in Transgender were published 2000–2009: too few to compare", for the
 * window with too few stories ("then" first); with a Length option, "… in Romance match “Under 2,000 words” and were
 * published …".
 */
export function tooFewHeading({ entry, genre, subset, file }) {
  const w = windowWords(file);
  const min = file.rule.min_n;
  const thenN = entry ? entry.t?.[0] ?? 0 : 0;
  const when = !entry || thenN < min ? w.then : w.now;
  const match = subset && subset.id !== "all" ? ` match “${subset.label}” and` : "";
  return `Fewer than ${min} stories in ${genre.name}${match} were published ${when}: too few to compare`;
}

/**
 * View 1's heading: "Story length in words clearly rose from 2000–2009 to 2020 or later", "The share of stories with an
 * author’s note clearly fell …", "Where sexual language peaks clearly moved later …", "Narrative perspective clearly
 * changed …", "No clear change in … from 2000–2009 to 2020 or later", or the too-few sentence when a window has fewer
 * than the rule's stories (r is null).
 */
export function trendHeading({ variable, entry, genre, subset, file }) {
  if (entry.r == null) return tooFewHeading({ entry, genre, subset, file });
  const w = windowWords(file);
  const noun = trendNoun(variable);
  if (!entry.f) return `No clear change in ${noun} from ${w.then} to ${w.now}`;
  return `${upperFirst(noun)} clearly ${changeWords(entry.k, entry.f)} from ${w.then} to ${w.now}`;
}

/**
 * The takeaway's numbers line (numbers, yes/no and mostly zero; nothing for named groups and bands, whose shares are in
 * the chart; nothing when the windows weren't compared), as text and { strong } parts:
 * "All genres: median **2,810** words in 2000–2009, **4,100** in 2020 or later."
 * "All genres: stories with an author’s note made up **18%** of stories in 2000–2009, **33%** in 2020 or later."
 * "All genres: stories with any, **11%** in 2000–2009 and **21%** in 2020 or later; among those, median 0.229 and 0.196
 * per 1,000 words."
 */
export function numbersLine({ variable, entry, genre, file, fmt, smallN = 30 }) {
  if (entry.r == null || !["num", "bin", "zero"].includes(entry.k)) return null;
  const all = file.g === "all";
  const then = trendCell(entry.k, entry.t, all, smallN);
  const now = trendCell(entry.k, entry.q[entry.q.length - 1], all, smallN);
  if (!then || !now) return null;
  const w = windowWords(file);
  const shares = [{ strong: fmt.share(then.share) }, { strong: fmt.share(now.share) }];
  if (entry.k === "bin") {
    return [`${genre.name}: ${lowerFirst(variable.yes_subject)} made up `, shares[0], ` of stories in ${w.then}, `, shares[1], ` in ${w.now}.`];
  }
  if (entry.k === "zero") {
    const parts = [`${genre.name}: stories with any, `, shares[0], ` in ${w.then} and `, shares[1], ` in ${w.now}`];
    if (then.median != null && now.median != null) parts.push(`; among those, median ${fmt.value(then.median)} and ${fmt.withUnit(now.median)}`);
    parts.push(".");
    return parts;
  }
  const first = fmt.value(then.median);
  const unit = withUnit(first, fmt.unit).slice(first.length); // " words" (" page" after exactly 1), or nothing
  return [`${genre.name}: median `, { strong: first }, `${unit} in ${w.then}, `, { strong: fmt.value(now.median) }, ` in ${w.now}.`];
}

/**
 * The fixed-mix line, for All genres when holding each genre's share of stories fixed gives another verdict (D12):
 * "Holding each genre’s share of stories fixed, the change is not clear." or "…, it clearly rose." (fell, moved later,
 * moved earlier, changed); null otherwise.
 */
export function mixFixedLine(entry, genreId) {
  if (genreId !== "all" || entry.r == null || entry.fm === undefined || entry.f === entry.fm) return null;
  if (!entry.fm) return "Holding each genre’s share of stories fixed, the change is not clear.";
  return `Holding each genre’s share of stories fixed, it clearly ${changeWords(entry.k, entry.fm)}.`;
}

/**
 * What View 1's chart draws from, before its width is known: the format, every period's cell, the axis, the table's
 * texts under the plot (the median or the share, and the stories with an asterisk under SMALL_N; named groups and
 * bands print only the stories, their shares being in the columns), the windows' words and "Fewer than 10" for a
 * column with nothing drawn. trendLayout() takes it with the width. Mostly-zero characteristics draw two of these
 * (trendSplitInputs).
 */
export function trendChartInput(meta, variable, entry, file) {
  const kind = entry.k;
  const all = file.g === "all";
  const fmt = trendFormat(variable, entry, all, meta.small_n);
  const cells = trendCells(entry, all, meta.small_n);
  const mix = kind === "grp" || kind === "band";
  return {
    kind,
    fmt,
    cells,
    axis: mix ? trendTicks("bin", [0, 1]) : trendTicks(kind, trendDomain(kind, cells)),
    percent: mix || kind === "bin" || entry.fmt === "percent",
    texts: cells.map((c) => ({
      value: mix ? "" : c ? (kind === "bin" ? fmt.share(c.share) : fmt.value(c.median)) : "–",
      stories: storiesText(c),
    })),
    valueHead: mix ? null : kind === "bin" ? "Share" : "Median",
    ...periodsInput(meta, file),
  };
}

const storiesText = (c) => (c ? `${formatCount(c.n)}${c.small ? "*" : ""}` : "–");
const periodsInput = (meta, file) => ({
  windows: windowWords(file),
  periods: file.periods,
  then: file.then,
  now: file.now,
  noneText: `Fewer than ${meta.min_n}`,
});

/**
 * The split chart's two halves (mostly-zero characteristics, §3.1): "Stories with any", the share of each period's
 * stories above 0 as share columns (as yes/no), and "Among stories with any", their quartiles as range columns (as
 * numbers) on their own axis, with the stories with any under each (hatched under SMALL_N; nothing drawn under MIN_N).
 * Each half: { title, axisTitle, input } for trendLayout().
 */
export function trendSplitInputs(meta, variable, entry, file) {
  const all = file.g === "all";
  const fmt = trendFormat(variable, entry, all, meta.small_n);
  const cells = trendCells(entry, all, meta.small_n);
  const shares = cells.map((c) => (c ? { n: c.n, share: c.share, small: c.small } : null));
  const among = cells.map((c) =>
    c && c.median != null ? { n: c.any, p25: c.p25, median: c.median, p75: c.p75, small: c.any < meta.small_n } : null,
  );
  const unit = plainUnit(variable, fmt.fmt);
  return [
    {
      title: "Stories with any",
      axisTitle: "Share of stories",
      input: {
        kind: "bin",
        fmt,
        cells: shares,
        axis: trendTicks("bin", trendDomain("bin", shares)),
        percent: true,
        texts: shares.map((c) => ({ value: c ? fmt.share(c.share) : "–", stories: storiesText(c) })),
        valueHead: "Share",
        ...periodsInput(meta, file),
      },
    },
    {
      title: "Among stories with any",
      axisTitle: unit || trendAxisTitle(variable, { k: "num", fmt: fmt.fmt }),
      input: {
        kind: "num",
        fmt,
        cells: among,
        axis: trendTicks("num", trendDomain("num", among)),
        percent: fmt.fmt === "percent",
        texts: among.map((c) => ({ value: c ? fmt.value(c.median) : "–", stories: storiesText(c) })),
        valueHead: "Median",
        ...periodsInput(meta, file),
      },
    },
  ];
}

/**
 * The groups' colors in the 100% columns (mixColors, as on the Genres page): named groups by their share over the
 * chart's periods (weighted by their stories), the largest darkest; ordered bands from light to dark in their order.
 */
export function trendMixColors(kind, cells, count) {
  const shown = cells.filter(Boolean);
  const total = shown.reduce((t, c) => t + c.n, 0);
  const overall = Array.from({ length: count }, (_, b) => (total ? shown.reduce((t, c) => t + c.n * c.shares[b], 0) / total : 0));
  return mixColors(kind, overall);
}

// ---------------------------------------------------------------------------------------------- periods' details
/**
 * A period's numbers in words, for its details and its name: "median 4,060 words · interquartile range 2,340–7,200 ·
 * 1,564 stories"; yes/no "32% with an author’s note · 1,564 stories"; mostly zero, as the Genres page says a genre's
 * "11% with any · among those, median 0.229 per 1,000 words · interquartile range 0.144–0.388 · 2,561 stories"; named
 * groups and bands every group's share; fewer than MIN_N "fewer than 10 stories".
 */
export function periodWords({ variable, entry, cell, fmt, minN }) {
  if (!cell) return [`fewer than ${minN} stories`];
  const stories = `${formatCount(cell.n)} stories`;
  if (entry.k === "bin") return [`${fmt.share(cell.share)} ${yesPhrase(variable)}`, stories];
  if (entry.k === "num") return [`median ${fmt.withUnit(cell.median)}`, `interquartile range ${fmt.span(cell.p25, cell.p75)}`, stories];
  if (entry.k === "zero") {
    const among =
      cell.median != null ? [`among those, median ${fmt.withUnit(cell.median)}`, `interquartile range ${fmt.span(cell.p25, cell.p75)}`] : [];
    return [`${fmt.share(cell.share)} with any`, ...among, stories];
  }
  return [...variable.bins.labels.map((label, b) => `${label} ${formatPercent(cell.shares[b])}`), stories];
}

/** A period's accessible name: "2015–19: median 4,060 words, interquartile range 2,340–7,200, 1,564 stories". */
export const periodName = (label, words) => `${label}: ${words.join(", ")}`;

// --------------------------------------------------------------------------------------------------------- the PNG
/** "Download PNG"'s file name: the characteristic's, the genre's and the option's ids, in lower case. */
export const trendsFileName = (state) => `trends-${state.v}-${state.genre}-${state.sub}.png`.toLowerCase();

/** What the polite live region says when View 1's characteristic, genre or option changes: the heading, then the
 * takeaway's lines. */
export function trendAnnouncement(meta, file, state) {
  const variable = meta.variables.find((v) => v.id === state.v);
  const entry = file.c[state.v];
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  if (!entry || !variable || !genre) return "";
  if (nothingToDraw(entry)) return `${tooFewHeading({ entry, genre, subset, file })}.`;
  const fmt = trendFormat(variable, entry, file.g === "all", meta.small_n);
  const numbers = numbersLine({ variable, entry, genre, file, fmt, smallN: meta.small_n });
  const mix = mixFixedLine(entry, file.g);
  return [
    `${trendHeading({ variable, entry, genre, subset, file })}.`,
    numbers ? numbers.map((seg) => (typeof seg === "string" ? seg : seg.strong)).join("") : "",
    mix || "",
  ]
    .filter(Boolean)
    .join(" ");
}
