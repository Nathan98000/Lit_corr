// The Trends page (STAGE2_TRENDS_PAGE_PROMPT.md, docs/stage2/TRENDS_PAGE_PROPOSAL.md): reading the trends/<included>/
// <genre>.json files (data.js) and every sentence of the page. The years come from the file or meta.trend, never from
// here; a characteristic "clearly" changed only through the file's flag (`f`).

import { formatCount, formatFixed } from "./format.js";
import { mixColors } from "./genreLayout.js";
import {
  comparisonBar,
  fileDecimals,
  formatPercent,
  noDifferenceZone,
  plainUnit,
  profileColumns,
  profileUnit,
  sharePair,
  withUnit,
} from "./genres.js";
import { periodLabel, trendDomain, trendTicks } from "./trendLayout.js";
import { genreWords, lowerFirst, upperFirst } from "./wording.js";

/** A genre in the page's sentences: "all genres" (the slot shows it in lower case; its option says "All genres"), else its name. */
export { genreWords };

/**
 * View 1's question, in parts around its two slots: "Across [all genres], how has [word count] changed over
 * time?" ("In [Romance], …" for a genre), "have" for a plural noun ("…, how have [very long paragraphs] changed …"),
 * and for yes/no characteristics the share of its stories, which is singular: "…, how has the share of [stories with
 * an author's note] changed over time?".
 */
export function trendQuestion(variable, genre) {
  const before = genre.id === "all" ? "Across " : "In ";
  if (variable.yes_subject) {
    return { before, middle: ", how has the share of ", slot: lowerFirst(variable.yes_subject), after: " changed over time" };
  }
  return { before, middle: `, how ${variable.plural ? "have" : "has"} `, slot: variable.noun, after: " changed over time" };
}

export function trendQuestionText(variable, genre) {
  const q = trendQuestion(variable, genre);
  return `${q.before}${genreWords(genre)}${q.middle}${q.slot}${q.after}?`;
}

/** View 2's question before its slot: "What has changed in stories across [all genres]?", "… in [Romance]?" */
export const changesQuestionStart = (genre) => `What has changed in stories ${genre.id === "all" ? "across" : "in"} `;

export const changesQuestion = (genre) => `${changesQuestionStart(genre)}${genreWords(genre)}?`;

/** Where a sample is from, at a sentence's end: "across all genres", "in Romance". */
const fromGenre = (genre) => (genre.id === "all" ? "across all genres" : `in ${genre.name}`);

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

/**
 * The chart's axis title: the label, with its unit when it is a rate the label doesn't name already ("Sexual language,
 * per 1,000 words", but "Sex scenes per 10,000 words" alone, as profileUnit leaves out a unit the label names); yes/no
 * characteristics, "…, share of stories".
 */
export function trendAxisTitle(variable, entry) {
  if (entry.k === "bin") return `${variable.yes_subject}, share of stories`;
  const unit = variable.unit || "";
  const named = variable.label.toLowerCase().includes(unit.toLowerCase());
  return /^per /.test(unit) && entry.fmt !== "percent" && !named ? `${variable.label}, ${unit}` : variable.label;
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
  const thenN = entry ? entry.t?.[0] ?? 0 : 0;
  return tooFewSentence(genre, subset, file, !entry || thenN < file.rule.min_n ? "then" : "now");
}

function tooFewSentence(genre, subset, file, which) {
  const match = subset && subset.id !== "all" ? ` match “${subset.label}” and` : "";
  return `Fewer than ${file.rule.min_n} stories in ${genre.name}${match} were published ${windowWords(file)[which]}: too few to compare`;
}

/**
 * View 1's heading: "Word count clearly rose from 2000–2009 to 2020 or later", "The share of stories with an
 * author’s note clearly fell …", "Where sexual language peaks clearly moved later …", "Narrative perspective clearly
 * changed …", "No clear change in … from 2000–2009 to 2020 or later", or the too-few sentence when a window has fewer
 * than the rule's stories (r is null). The site's rule alone decides (the file's `f`).
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
 * the chart; nothing when the windows weren't compared), as text and { strong } parts; the question above it names the
 * genre:
 * "Median **2,810** words in 2000–2009, **4,100** in 2020 or later."
 * "Stories with an author’s note made up **18%** of stories in 2000–2009, **33%** in 2020 or later."
 * "Stories with any, **11%** in 2000–2009 and **21%** in 2020 or later; among those, median 0.229 and 0.196 per 1,000
 * words."
 */
export function numbersLine({ variable, entry, file, fmt, smallN = 30 }) {
  if (entry.r == null || !["num", "bin", "zero"].includes(entry.k)) return null;
  const all = file.g === "all";
  const then = trendCell(entry.k, entry.t, all, smallN);
  const now = trendCell(entry.k, entry.q[entry.q.length - 1], all, smallN);
  if (!then || !now) return null;
  const w = windowWords(file);
  const shares = [{ strong: fmt.share(then.share) }, { strong: fmt.share(now.share) }];
  if (entry.k === "bin") {
    return [`${upperFirst(variable.yes_subject)} made up `, shares[0], ` of stories in ${w.then}, `, shares[1], ` in ${w.now}.`];
  }
  if (entry.k === "zero") {
    const parts = ["Stories with any, ", shares[0], ` in ${w.then} and `, shares[1], ` in ${w.now}`];
    if (then.median != null && now.median != null) parts.push(`; among those, median ${fmt.value(then.median)} and ${fmt.withUnit(now.median)}`);
    parts.push(".");
    return parts;
  }
  const first = fmt.value(then.median);
  const unit = withUnit(first, fmt.unit).slice(first.length); // " words" (" page" after exactly 1), or nothing
  return ["Median ", { strong: first }, `${unit} in ${w.then}, `, { strong: fmt.value(now.median) }, ` in ${w.now}.`];
}

// what a characteristic measures, under one characteristic's heading (genres.js: both pages say it)
export { whatItMeasures } from "./genres.js";

/** Does a period lie outside both windows compared (2010–14 and 2015–19 today), by the file's windows? */
export const middlePeriod = (p, file) => !(p[0] >= file.then[0] && p[1] <= file.then[1]) && p[0] < file.now[0];

/**
 * The path line (numbers, yes/no, and mostly zero's share of stories with any): when a period between the windows, with
 * at least SMALL_N stories, lies beyond both windows' values by more than 3 percentage points (shares) or 10% of the
 * larger window's median (numbers), the most extreme one is named, so "No clear change" never sits silently beside a
 * dip: "In between, it dipped to 5% in 2010–14." or "In between, the median rose to 4,920 words in 2015–19." It
 * describes; it never says "clearly". Null otherwise, and when the windows weren't compared.
 */
export function pathLine({ entry, file, fmt, smallN = 30 }) {
  if (entry.r == null || !["num", "bin", "zero"].includes(entry.k)) return null;
  const all = file.g === "all";
  const share = entry.k !== "num";
  const value = (c) => (c ? (share ? c.share : c.median) : null);
  const ends = [trendCell(entry.k, entry.t, all, smallN), trendCell(entry.k, entry.q[entry.q.length - 1], all, smallN)].map(value);
  if (ends.some((v) => v == null)) return null;
  const [lo, hi] = [Math.min(...ends), Math.max(...ends)];
  const margin = share ? 0.03 : 0.1 * Math.max(...ends.map(Math.abs));
  let best = null;
  file.periods.forEach((p, i) => {
    if (!middlePeriod(p, file)) return;
    const c = trendCell(entry.k, entry.q[i], all, smallN);
    const v = value(c);
    if (v == null || c.n < smallN) return;
    const beyond = v > hi + margin ? v - hi : v < lo - margin ? lo - v : 0;
    if (beyond > 0 && (!best || beyond > best.beyond)) best = { beyond, v, up: v > hi, period: periodLabel(p) };
  });
  if (!best) return null;
  const moved = best.up ? "rose" : "dipped";
  return share
    ? `In between, it ${moved} to ${fmt.share(best.v)} in ${best.period}.`
    : `In between, the median ${moved} to ${fmt.withUnit(best.v)} in ${best.period}.`;
}

/**
 * The numbers on the brackets of the two windows compared, as the takeaway gives them, in the chart's own format
 * (`kind`: num, bin, or a mostly-zero chart's halves "any" and "among"): { then, now }, each "median 2,810", "9%",
 * "57% with any" or null (no number: too few stories in that window, or among its stories with any); null when the
 * windows weren't compared, and for named groups and bands, whose brackets keep their words.
 */
export function windowNumbers({ entry, file, fmt, kind = entry.k, smallN = 30 }) {
  if (entry.r == null || !["num", "bin", "any", "among"].includes(kind)) return null;
  const all = file.g === "all";
  const words = (cell) => {
    const c = trendCell(entry.k, cell, all, smallN);
    if (!c) return null;
    if (kind === "bin") return fmt.share(c.share);
    if (kind === "any") return `${fmt.share(c.share)} with any`;
    return c.median != null ? `median ${fmt.value(c.median)}` : null;
  };
  return { then: words(entry.t), now: words(entry.q[entry.q.length - 1]) };
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
    windowValues: windowNumbers({ entry, file, fmt, smallN: meta.small_n }),
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
        windowValues: windowNumbers({ entry, file, fmt, kind: "any", smallN: meta.small_n }),
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
        windowValues: windowNumbers({ entry, file, fmt, kind: "among", smallN: meta.small_n }),
        ...periodsInput(meta, file),
      },
    },
  ];
}

/**
 * The groups' colors in the 100% columns (mixColors, as on the Genres page): named groups by their shares in 2000–2009
 * (`reference`: the windows' reference, as all genres is on the Genres page, so View 1 and View 2 color each group
 * alike), else by their share over the chart's periods (weighted by their stories), the largest darkest; ordered bands
 * from light to dark in their order.
 */
export function trendMixColors(kind, cells, count, reference = null) {
  if (reference) return mixColors(kind, reference);
  const shown = cells.filter(Boolean);
  const total = shown.reduce((t, c) => t + c.n, 0);
  const overall = Array.from({ length: count }, (_, b) => (total ? shown.reduce((t, c) => t + c.n * c.shares[b], 0) / total : 0));
  return mixColors(kind, overall);
}

/**
 * The groups the 100% columns draw, in their own order, with their colors (trendMixColors): named groups that are under
 * 3% in every period drawn, when there are two or more, become one "Other" segment in a neutral color, last, its key
 * naming them ("Other (first person plural (we), second person (you), mixed)"); one such group stays itself, and bands
 * never merge. [{ label, cls, ink, members (the groups' indices) }]; the details keep every group's share.
 */
export function trendMixGroups(kind, cells, labels, reference = null) {
  const colors = trendMixColors(kind, cells, labels.length, reference);
  const drawn = cells.filter(Boolean);
  const small = kind === "grp" && drawn.length ? labels.map((_, b) => b).filter((b) => drawn.every((c) => c.shares[b] < 0.03)) : [];
  const merged = new Set(small.length >= 2 ? small : []);
  const groups = labels
    .map((label, b) => ({ label, cls: colors[b].cls, ink: colors[b].ink, members: [b] }))
    .filter((g) => !merged.has(g.members[0]));
  if (merged.size) {
    const names = [...merged].map((b) => lowerFirst(labels[b])).join(", ");
    groups.push({ label: `Other (${names})`, cls: "pal-other", ink: "dark", members: [...merged] });
  }
  return groups;
}

/** A column's shares by the groups drawn (trendMixGroups): the merged groups' shares added up. */
export const groupShares = (groups, shares) => groups.map((g) => g.members.reduce((t, b) => t + shares[b], 0));

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
/** "Download image"'s file name: the characteristic's, the genre's and the option's ids, in lower case. */
export const trendsFileName = (state) => `trends-${state.v}-${state.genre}-${state.sub}.png`.toLowerCase();

/** View 2's "Download image" (its lists): "trends-changes-all-all.png", the genre's and the option's ids (the file's). */
export const changesFileName = (file) => `trends-changes-${file.g}-${file.s}.png`.toLowerCase();

/** What the polite live region says when View 1's characteristic, genre or option changes: the question (which names
 * the genre, as the takeaway no longer does), the heading, then the takeaway's lines. */
export function trendAnnouncement(meta, file, state) {
  const variable = meta.variables.find((v) => v.id === state.v);
  const entry = file.c[state.v];
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  if (!entry || !variable || !genre) return "";
  const question = trendQuestionText(variable, genre);
  if (nothingToDraw(entry)) return `${question} ${tooFewHeading({ entry, genre, subset, file })}.`;
  const fmt = trendFormat(variable, entry, file.g === "all", meta.small_n);
  const numbers = numbersLine({ variable, entry, file, fmt, smallN: meta.small_n });
  const path = pathLine({ entry, file, fmt, smallN: meta.small_n });
  return [
    question,
    `${trendHeading({ variable, entry, genre, subset, file })}.`,
    numbers ? numbers.map((seg) => (typeof seg === "string" ? seg : seg.strong)).join("") : "",
    path || "",
  ]
    .filter(Boolean)
    .join(" ");
}

// ------------------------------------------------------------------------------------------- View 2: what changed
/** The two windows' stories, from the periods' counts: { then: 2561, now: 3346 } (All genres, all stories). */
export function windowCounts(file) {
  const counts = { then: 0, now: 0 };
  file.periods.forEach((p, i) => {
    if (p[0] >= file.then[0] && p[1] <= file.then[1]) counts.then += file.n[i];
    if (p[0] >= file.now[0]) counts.now += file.n[i];
  });
  return counts;
}

/** Were the genre's two windows compared: at least the rule's min_n stories in each (not Chain Stories, Transgender)? */
export function windowsCompared(file) {
  const c = windowCounts(file);
  return c.then >= file.rule.min_n && c.now >= file.rule.min_n;
}

/** View 2's too-few heading, for the window with too few stories: "Fewer than 30 stories in Transgender were published 2000–2009: …". */
export const changesTooFewHeading = (file, genre, subset) =>
  tooFewSentence(genre, subset, file, windowCounts(file).then < file.rule.min_n ? "then" : "now");

/**
 * What changed (View 2): "One genre" relabeled (§4.1), every characteristic of the file in the topics' order with its
 * flag, the dot's side (`stats`: 2020 or later) and the other (`all`: 2000–2009), in the shape genreProfile() gives
 * them; { lower, higher, mix } (flagged, ordered by |r|, ties in the topics' order), how many were compared, and the
 * topics that have characteristics on this page, with how many changed.
 */
export function trendProfile(meta, file) {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const all = file.g === "all";
  const zone = noDifferenceZone(file.rule);
  const order = meta.topics.flatMap((t) => t.ids).filter((id) => file.c[id] && byId.has(id));
  const items = order.map((id, pos) => {
    const entry = file.c[id];
    const variable = byId.get(id);
    return {
      id,
      pos,
      variable,
      entry,
      nf: trendFormat(variable, entry, all, meta.small_n),
      kind: entry.k,
      stats: trendCell(entry.k, entry.q[entry.q.length - 1], all, meta.small_n),
      all: trendCell(entry.k, entry.t, all, meta.small_n),
      r: entry.r,
      f: entry.f,
      zone,
    };
  });
  const bySize = (a, b) => Math.abs(b.r) - Math.abs(a.r) || a.pos - b.pos;
  const flagged = items.filter((x) => x.f);
  const compared = (list) => list.filter((x) => x.r != null).length;
  const topics = meta.topics
    .map((topic) => {
      const own = items.filter((x) => x.variable.topic === topic.id);
      return { topic, items: own, count: own.filter((x) => x.f).length, compared: compared(own) };
    })
    .filter((t) => t.items.length);
  return {
    items,
    compared: compared(items),
    flagged: [...flagged].sort(bySize),
    lower: flagged.filter((x) => x.kind !== "grp" && x.f < 0).sort(bySize),
    higher: flagged.filter((x) => x.kind !== "grp" && x.f > 0).sort(bySize),
    mix: flagged.filter((x) => x.kind === "grp").sort(bySize),
    topics,
  };
}

/**
 * "26 of 180 characteristics clearly changed from 2000–2009 to 2020 or later", "1 of 180 characteristics …", "None of
 * the 180 characteristics …": `count` of the `compared` characteristics (those compared in this file: 180 with All
 * stories, 179 with a Length option, fewer in a genre where some have too few stories).
 */
export function changesHeading(count, compared, file) {
  const w = windowWords(file);
  const m = formatCount(compared);
  const what = count === 0 ? `None of the ${m} characteristics` : `${formatCount(count)} of ${m} characteristics`;
  return `${what} clearly changed from ${w.then} to ${w.now}`;
}

/**
 * The length line, first in the takeaway when word count is in the file and clearly changed: "Stories got longer:
 * median 2,810 words in 2000–2009, 4,100 in 2020 or later." ("shorter" when it fell); null otherwise, and with the
 * Length options, which leave word count out. Its numbers as View 1's chart prints them.
 */
export function lengthLine(p, file) {
  const item = p.items.find((x) => x.id === "story_words");
  if (!item?.f || item.all?.median == null || item.stats?.median == null) return null;
  const w = windowWords(file);
  const moved = item.f > 0 ? "longer" : "shorter";
  return `Stories got ${moved}: median ${item.nf.withUnit(item.all.median)} in ${w.then}, ${item.nf.value(item.stats.median)} in ${w.now}.`;
}

/** The medians' relative change after the values: " (+82%)", " (−25%)", grouped as the site's counts ("+23,640%"); "" for none. */
const percentWords = (change) => (change == null ? "" : ` (${change > 0 ? "+" : change < 0 ? "−" : ""}${formatCount(Math.abs(change))}%)`);

/**
 * A row's values, right after its label (item 4): the 2000–2009 window's, then the 2020-or-later window's, as the
 * columns print them (profileColumns: medians trimmed of trailing zeros, shares, the shares with any, median bands,
 * the named group that changed most), with the medians' relative change, rounded, for numbers with a plain unit
 * (words, sentences, per 1,000 words …) and both medians above 0: "51.6 → 38.8 (−25%)", "57% → 40%". { text, change
 * (the percent, or null), second (the medians among those with any, under a mostly-zero row whose share goes the other
 * way from its dot), unit }.
 */
export function changesValues(item) {
  const cols = changesColumns(item);
  const then = cols.genre ? cols.genre[0] : "–";
  const now = cols.all ? cols.all[0] : "–";
  const plain = item.kind === "num" && Boolean(item.nf.unit);
  const change = plain && item.all?.median > 0 && item.stats?.median > 0 ? Math.round(((item.stats.median - item.all.median) / item.all.median) * 100) || 0 : null;
  const pct = percentWords(change);
  const second = cols.genre?.[1] && cols.all?.[1] ? `${cols.genre[1]} → ${cols.all[1]}` : null;
  return { text: `${then} → ${now}${pct}`, change, second, unit: cols.unit };
}

/**
 * The scale of "What changed"'s dots (item 4): 50 ± d out of 100, for the whole view (every list and topic of the
 * file, so opening a topic never rescales anything): d is the largest distance from 50 among the compared rows' dots,
 * plus 5, rounded up to a multiple of 5, between 20 and 50 (25 for All genres with All stories: 34 to 68). Ticks every
 * 10. { lo, hi, d, ticks }.
 */
export function changesScale(p) {
  const far = Math.max(0, ...p.items.filter((x) => x.r != null && x.kind !== "grp").map((x) => 50 * Math.abs(x.r)));
  const d = Math.min(50, Math.max(20, Math.ceil((far + 5) / 5 - 1e-9) * 5));
  const ticks = [];
  for (let t = Math.ceil((50 - d) / 10) * 10; t <= 50 + d; t += 10) ticks.push(t);
  return { lo: 50 - d, hi: 50 + d, d, ticks };
}

/**
 * "2,561 stories from 2000–2009 and 3,346 from 2020 or later across all genres." ("… in Romance."; an option: "… match
 * “Under 2,000 words”.")
 */
export function changesSampleLine(file, genre, subset) {
  const w = windowWords(file);
  const c = windowCounts(file);
  const match = subset && subset.id !== "all" ? ` match “${subset.label}”` : "";
  return `${formatCount(c.then)} stories from ${w.then} and ${formatCount(c.now)} from ${w.now} ${fromGenre(genre)}${match}.`;
}

/**
 * The picker's group of the clear changes (View 1, phase 7): { title, items: [{ id, mark, word }] }, largest first as
 * View 2 orders them, each with its mark and its word ("fell", "rose", "changed"): "Clearly changed in all genres",
 * "Clearly changed in Romance · 2,000–5,000 words"; null when nothing changed or nothing was compared.
 */
export function pickerChanges(meta, file) {
  if (!windowsCompared(file)) return null;
  const p = trendProfile(meta, file);
  if (!p.flagged.length) return null;
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  const option = subset && subset.id !== "all" ? ` · ${subset.label}` : "";
  return {
    title: `Clearly changed ${genre.id === "all" ? "in all genres" : `in ${genre.name}`}${option}`,
    items: p.flagged.map((x) => ({
      id: x.id,
      mark: x.kind === "grp" ? "≠" : x.f > 0 ? "▲" : "▼",
      word: x.kind === "grp" ? "changed" : x.f > 0 ? "rose" : "fell",
    })),
  };
}

/**
 * The characteristic "One characteristic over time →" opens from a genre too few to compare (View 2's too-few state):
 * the one remembered, or word count, but paragraph count when the option rules word count out.
 */
export function overTimeCharacteristic(meta, state) {
  const subset = meta.subsets.find((s) => s.id === state.sub);
  const v = state.v || "story_words";
  const ruledOut = subset?.group === "Length" && v === "story_words";
  return ruledOut ? "story_paragraphs" : v;
}

/**
 * The takeaway (S1): "▲ Rose: …", "▼ Fell: …", "≠ A different mix: …", each up to three labels, as the lists word them,
 * and how many more its list holds (`more`, round 4's F118).
 */
export function changesTakeaway(p) {
  const line = (mark, word, list) => ({
    mark,
    word,
    items: list.slice(0, 3).map((x) => lowerFirst(x.variable.label)),
    more: Math.max(0, list.length - 3),
  });
  // what rose first, as the lists are (the owner, 2026-10-13)
  return [line("▲", "Rose", p.higher), line("▼", "Fell", p.lower), line("≠", "A different mix", p.mix)].filter((l) => l.items.length);
}

/** A takeaway line's words after its word: "average paragraph length, median paragraph length, very long paragraphs and 2 more." */
export const changesLineWords = (line) => `${line.items.join(", ")}${line.more ? ` and ${line.more} more` : ""}.`;

/**
 * A row's two columns in chronological order, 2000–2009 then 2020 or later ("One genre"'s columns, profileColumns,
 * with the dot's side second).
 */
export function changesColumns(item) {
  const cols = profileColumns(item, { pair: false });
  return { ...cols, genre: cols.all, all: cols.genre };
}

/**
 * A row's accessible name in View 2 (F92), its numbers in reading order: "Paragraph count: 68 in 100; 2000–2009 56, 2020
 * or later 102 paragraphs; clearly rose. Opens its chart over time." Not clear: "no clear change"; r null: "too few
 * stories to compare", without the dot's number; a window without the numbers, "fewer than 10 stories". Mostly zero:
 * "2000–2009 11% with any, 2020 or later 21%", with "; among those, median …" where the medians show; bands: "median
 * …"; named groups: "% of stories", then every group's share in both.
 */
export function changesRowName(item, file, minN) {
  const { kind, variable } = item;
  const w = windowWords(file);
  const cols = changesColumns(item);
  const [then, now] = [item.all, item.stats];
  const cmp = item.r == null ? "too few stories to compare" : !item.f ? "no clear change" : `clearly ${changeWords(kind, item.f)}`;
  const end = `; ${cmp}. Opens its chart over time.`;
  const bar = comparisonBar(item.r, { flagged: Boolean(item.f), zone: item.zone });
  const times = item.r == null || kind === "grp" ? "" : ` ${bar.times} in 100;`;
  const few = `fewer than ${minN} stories`;
  if (kind === "grp") {
    // each group's two shares as the columns print theirs (sharePair)
    const pairs = then && now && variable.bins.labels.map((_, b) => sharePair(then.shares[b], now.shares[b]));
    const shares = (s, k) =>
      s ? variable.bins.labels.map((l, b) => `${l} ${pairs ? pairs[b][k] : formatPercent(s.shares[b])}`).join(", ") : few;
    return `${variable.label}, % of stories: ${w.then} ${shares(then, 0)}; ${w.now} ${shares(now, 1)}${end}`;
  }
  const thenN = cols.genre ? cols.genre[0] : few;
  const nowN = cols.all ? cols.all[0] : few;
  if (kind === "band") {
    const median = (n) => (n === few ? n : `median ${lowerFirst(n)}`);
    return `${variable.label}:${times} ${w.then} ${median(thenN)}, ${w.now} ${median(nowN)}${end}`;
  }
  if (kind === "zero") {
    let among = "";
    if (cols.genre?.[1]) {
      const unit = profileUnit(item);
      const [tm, nm] = [cols.genre[1], cols.all[1]];
      if (tm !== "–" && nm !== "–") among = `; among those, median ${tm} and ${withUnit(nm, unit)}`;
      else if (nm !== "–") among = `; among those, median ${withUnit(nm, unit)} in ${w.now}`;
      else if (tm !== "–") among = `; among those, median ${withUnit(tm, unit)} in ${w.then}`;
    }
    const withAny = cols.genre ? `${thenN} with any` : thenN;
    return `${variable.label}:${times} ${w.then} ${withAny}, ${w.now} ${nowN}${among}${end}`;
  }
  const unit = kind === "num" ? cols.unit : "";
  // a scale's text that starts with a number follows a comma ("0.468, −1 (all negative) to +1 (all positive)")
  const last = !cols.all ? nowN : /^[−+\d]/.test(unit) ? `${nowN}, ${unit}` : withUnit(nowN, unit);
  // the medians' relative change, as the row prints it ("51.6 → 38.8 (−25%)")
  const { change } = changesValues(item);
  const pct = percentWords(change);
  return `${variable.label}:${times} ${w.then} ${thenN}, ${w.now} ${last}${pct}${end}`;
}

/**
 * View 2's words for ComparisonProfile: the column heads ("2000–09", "2020+"), the lists' titles, the axis title, the
 * zone's words, the note (one sentence, without a link: the owner's words), the mix line, the topics' line and the
 * count's word, from the windows (`file`).
 */
export function changesWords(file) {
  const w = windowWords(file);
  const heads = [periodLabel(file.then), `${file.now[0]}+`];
  const title = (mark, word) => ({ mark, word, full: `${word} from ${w.then} to ${w.now}` });
  return {
    heads: () => heads,
    // the values' head, "Median story or share" over "2000–09 → 2020+" (values first, item 4): the numbers are each
    // window's median story, or a share of stories, so "Average paragraph length" reads as the median story's average
    // (fresh eyes: "averages or medians?", 4/6; with "Median or share", "a median of an average?", 6/6)
    valuesHead: ["Median story or share", heads.join(" → ")],
    // "Show all 21 that rose" (fresh eyes: "Show all 21" read against the heading's 26 on phones, where a list's count
    // is left to screen readers)
    showAll: (n, list) => `Show all ${formatCount(n)} that ${list === "lower" ? "fell" : list === "higher" ? "rose" : "changed"}`,
    // "▼ Fell" on screen, the marks hidden; screen readers keep "Fell from 2000–2009 to 2020 or later" (the periods are
    // in the heading)
    lists: {
      lower: title("▼", "Fell"),
      higher: title("▲", "Rose"),
      mix: title("≠", "A different mix"),
    },
    // "comes out higher", not "scores higher", which on a site about ratings read as a rating (the fresh eyes' third round)
    axisTitle: `How often a story from ${w.now} comes out higher than a story from ${w.then}, out\u00a0of\u00a0100`,
    zone: "no clear change",
    // what a dot compares and what a row opens (round 4's W1: "Click" on a device that can hover), in open topics too
    note: ({ tap = false } = {}) => `Each dot compares a story from ${w.now} with a story from ${w.then} (50 is a tie). ${tap ? "Tap" : "Click"} a row for its chart over time.`,
    // the bars in time's order, 2000–2009 above (item 4)
    mixLine: ({ inTopic = false } = {}) => `${inTopic ? "" : "A different mix: "}${w.then} above, ${w.now} below`,
    topicsLine: "How many characteristics in each topic changed. Open a topic to see them all: blue dots changed, gray dots show no clear change.",
    topicCount: (t) => {
      if (t.compared) return { k: t.count, m: t.compared, text: `${t.count} of ${t.compared} changed` };
      const n = t.items.length;
      return { n, text: `${n} characteristic${n === 1 ? "" : "s"}` };
    },
    countWord: "changed",
  };
}

/** What the polite live region says for View 2: the question, the heading, then the takeaway's lines; or the question
 * and the too-few sentence. */
export function changesAnnouncement(meta, file, state) {
  const genre = meta.genres.find((g) => g.id === file.g);
  const subset = meta.subsets.find((s) => s.id === file.s);
  if (!genre) return "";
  const question = changesQuestion(genre);
  if (!windowsCompared(file)) return `${question} ${changesTooFewHeading(file, genre, subset)}.`;
  const p = trendProfile(meta, file);
  const lines = changesTakeaway(p).map((line) => `${line.word}: ${changesLineWords(line)}`);
  return [question, `${changesHeading(p.flagged.length, p.compared, file)}.`, lengthLine(p, file), ...lines].filter(Boolean).join(" ");
}
