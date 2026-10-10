// The Genres page's pure helpers: reading genres/<included>.json (see data.js), the numbers' formats, and every
// sentence the page says. A genre "clearly differs" only through the file's flags (`f`, the rule in meta.genre_rule);
// nothing here ranks genres, except the "By median" order the reader asks for (D3).

import { formatCount, formatFixed, stepDecimals } from "./format.js";
import { chartQuestion, chartQuestionText, lowerFirst, standsOutQuestion } from "./wording.js";

export { chartQuestion, chartQuestionText, standsOutQuestion };

// --------------------------------------------------------------------------------------------- numbers and units
/**
 * A share as a percentage (yes/no characteristics, stories with any, named groups and bands): whole percents, one
 * decimal under 1%, and "<0.1%" for a share above 0 that would read "0.0%": no percentage reads "0%" unless it is 0
 * (F66).
 */
export function formatPercent(v) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (v === 0) return "0%";
  const p = v * 100;
  if (Math.abs(p) >= 1) return `${formatFixed(p, 0)}%`;
  if (Number(Math.abs(p).toFixed(1)) === 0) return p > 0 ? "<0.1%" : ">−0.1%";
  return `${formatFixed(p, 1)}%`;
}

/** Decimals of a number as the file writes it: three significant digits, no trailing zeros (2050 → 0, 0.0588 → 4). */
export function fileDecimals(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return 0;
  const text = String(Math.abs(v));
  if (text.includes("e")) {
    const [mantissa, exp] = text.split("e");
    return Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exp));
  }
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** A value with two significant digits ("0.088", "8.5", "0.0034"). */
function twoDigits(v) {
  const r = Number(v.toPrecision(2));
  return formatFixed(r, Math.max(0, 1 - Math.floor(Math.log10(Math.abs(r)))));
}

const significantDigits = (text) => text.replace(/[^0-9]/g, "").replace(/^0+/, "").length;

/** A percentage characteristic's value with `d` decimals, never "0%" above 0 (one decimal, then "<0.1%"). */
function percentValue(v, d) {
  const p = v * 100;
  if (v === 0 || Number(p.toFixed(d)) !== 0) return `${formatFixed(p, d)}%`;
  if (Number(p.toFixed(1)) !== 0) return `${formatFixed(p, 1)}%`;
  return p > 0 ? "<0.1%" : ">−0.1%";
}

/**
 * How one characteristic's chart prints its numbers, wherever they appear (F66): View 1's value column, the All genres
 * line, the dashed line's label, the details, the row names and the table, and View 2's values, row names and table.
 * - Numbers (fmt "num"): one number of decimals for the whole chart, the most among All genres' median and
 *   quartiles as the file writes them (among the stories with any, for mostly-zero characteristics), at most 3 ("43.0
 *   words, interquartile range 31.7–62.2"). A value above 0 that those decimals would round to 0, or to a single
 *   significant digit, gets two significant digits instead ("0.088"); a whole value they write exactly keeps them
 *   ("2 pages").
 * - Percentages (fmt "percent"): whole percents, with one decimal when All genres' median is under 10%; never "0%"
 *   above 0.
 * - Years: whole. Minus signs are "−". Ranges take an en dash ("2,050–6,320"), or "to" when either end is negative
 *   ("−0.333 to 0.059").
 * Returns { value(v), span(lo, hi), unit (the plain unit, or ""), withUnit(v) }; shares use formatPercent().
 */
export function numberFormat(variable, entry) {
  const fmt = entry.fmt || "num";
  const all = cellStats(entry, 0);
  const qs = all && all.median != null ? [all.p25, all.median, all.p75] : [];
  const d =
    fmt === "percent" ? (qs.length && Math.abs(all.median) < 0.1 ? 1 : 0) : Math.min(3, Math.max(0, ...qs.map(fileDecimals)));
  const value = (v) => {
    if (v == null || !Number.isFinite(v)) return "–";
    if (fmt === "year") return String(Math.round(v));
    if (fmt === "percent") return percentValue(v, d);
    const text = formatFixed(v, d);
    if (v === 0) return text;
    const rounded = Number(v.toFixed(d));
    const lost = Math.abs(rounded - v) > 1e-9 * Math.max(1, Math.abs(v));
    return lost && (rounded === 0 || significantDigits(text) < 2) ? twoDigits(v) : text;
  };
  const unit = plainUnit(variable, fmt);
  return {
    fmt,
    decimals: d,
    value,
    span: (lo, hi) => `${value(lo)}${lo < 0 || hi < 0 ? " to " : "–"}${value(hi)}`,
    unit,
    withUnit: (v) => withUnit(value(v), unit),
  };
}

/** A genre's median age in this option: one decimal ("10.7 years"). */
export const formatYears = (age) => (age == null ? "–" : `${formatFixed(age, 1)} years`);

/**
 * The unit written after a number, when it is a plain unit (words, per 1,000 words, letters, names …): ranges only,
 * no parentheses, not a share, yes/no, "1 =", position or year, and a plural or a rate ("part" and "US school grade"
 * are left out); never for percentages, years or scales. Unlike unitNote() in wording.js it is kept when the noun names
 * the unit too, so story length reads "3,610 words".
 */
export function plainUnit(variable, fmt = "num") {
  const u = variable.unit || "";
  if (fmt !== "num" || variable.bins.type !== "ranges" || !u || u.includes("(")) return "";
  if (/^(share|yes|1 =|position|year$)/.test(u)) return "";
  return /^per /.test(u) || /s$/.test(u) ? u : "";
}

/** A number as printed, with its unit: "3,610 words", "0.422 per 1,000 words", "1 page" (exactly "1": singular). */
export function withUnit(text, unit) {
  if (!unit) return text;
  const single = text === "1" && !unit.includes(" ") && unit.endsWith("s");
  return `${text} ${single ? (unit.endsWith("ies") ? `${unit.slice(0, -3)}y` : unit.slice(0, -1)) : unit}`;
}

// ------------------------------------------------------------------------------------------------ reading the file
/** The form of a characteristic on this page, from the file: "num", "zero", "bin", "grp" or "band". */
export const kindOf = (entry) => entry.k;

/**
 * One genre's numbers for one characteristic (index i of the file's genres; 0 is all genres), or null when fewer than
 * meta.min_n stories have it. num: { n, p25, median, p75 } (all genres also p10, p90); zero: { n, above, share } and
 * { p25, median, p75 } among the stories above 0 when at least min_n are; bin: { n, share }; grp and band:
 * { n, shares }.
 */
export function cellStats(entry, i) {
  const c = entry.q[i];
  if (!c) return null;
  const n = c[0];
  if (entry.k === "num") {
    return i === 0
      ? { n, p10: c[1], p25: c[2], median: c[3], p75: c[4], p90: c[5] }
      : { n, p25: c[1], median: c[2], p75: c[3] };
  }
  if (entry.k === "zero") {
    const z = entry.z[i];
    const share = i === 0 ? z[1] : z[0] / n; // a genre's share is its two counts (all genres: weighted)
    const q = i === 0 ? z.slice(2) : z.slice(1);
    const out = { n, above: z[0], share };
    if (q.length === 3) Object.assign(out, { p25: q[0], median: q[1], p75: q[2] });
    return out;
  }
  if (entry.k === "bin") return { n, share: c[1] };
  return { n, shares: c.slice(1) };
}

/** For ordered bands: the band holding a quantile, from the cumulative shares (0-based). */
export function bandAt(shares, q) {
  let cum = 0;
  for (let b = 0; b < shares.length; b += 1) {
    cum += shares[b];
    if (cum >= q - 1e-9) return b;
  }
  return shares.length - 1;
}

/** An ordered band characteristic's quartile bands: { p25, median, p75 } as band indices. */
export const bandQuartiles = (shares) => ({ p25: bandAt(shares, 0.25), median: bandAt(shares, 0.5), p75: bandAt(shares, 0.75) });

/**
 * One row per genre (all genres first), in the file's order (meta.genres: A–Z): { i, genre, all, stats, small, r, f,
 * age }. `small`: fewer than the rule's min_n stories (drawn as uncertain, never flagged).
 */
export function genreRows(meta, file, id) {
  const entry = file.c[id];
  if (!entry) return null;
  const byId = new Map(meta.genres.map((g) => [g.id, g]));
  return file.genres.map((gid, i) => {
    const stats = cellStats(entry, i);
    return {
      i,
      genre: byId.get(gid) || { id: gid, name: gid },
      all: i === 0,
      stats,
      small: Boolean(stats) && i > 0 && stats.n < file.rule.min_n,
      r: entry.r[i],
      f: entry.f[i],
      age: file.age[i],
    };
  });
}

/** The value genres are put in order by (D3): the median, the share, or the share above 0. */
export function orderValue(kind, stats) {
  if (!stats) return null;
  if (kind === "num") return stats.median;
  if (kind === "bin" || kind === "zero") return stats.share;
  return null;
}

/** "By median" (or by share): descending, ties A–Z, genres with too few stories last; All genres stays first. */
export function orderRows(rows, kind, sort) {
  if (sort !== "value") return rows;
  const [all, ...rest] = rows;
  const sorted = rest
    .map((row, k) => ({ row, k, v: orderValue(kind, row.stats) }))
    .sort((a, b) => (a.v == null) - (b.v == null) || (b.v ?? 0) - (a.v ?? 0) || a.k - b.k)
    .map((x) => x.row);
  return [all, ...sorted];
}

/** The order toggle's second option. */
export const orderLabel = (kind) => (kind === "bin" ? "By share" : kind === "zero" ? "By share above 0" : "By median");

// ----------------------------------------------------------------------------------------------- comparisons, words
/** The words for a genre that clearly differs (D10): the characteristic's own, else Higher / Lower (yes/no: More / Less common). */
export function directionWords(variable, kind) {
  if (variable.more_word && variable.less_word) return [variable.more_word, variable.less_word];
  return kind === "bin" ? ["More common", "Less common"] : ["Higher", "Lower"];
}

/**
 * How a genre compares with all genres, in words: `short` for the details card and the table ("Clearly shorter",
 * "No clear difference"), `long` for a row's name ("clearly shorter than all genres"), `mark` (▲ ▼ ≠) and `word`
 * (the D10 word or its default, lower case: "shorter", "more common", "different mix"). All genres has none.
 */
export function comparison(row, variable, kind, minN) {
  if (row.all || !row.stats) return null;
  if (row.small) return { short: "Too few stories to compare", long: "too few stories to compare", mark: "", word: "" };
  if (!row.f) return { short: "No clear difference", long: "no clear difference from all genres", mark: "", word: "" };
  if (kind === "grp") {
    return { short: "A clearly different mix", long: "a clearly different mix from all genres", mark: "≠", word: "different mix" };
  }
  const [more, less] = directionWords(variable, kind);
  const word = (row.f > 0 ? more : less).toLowerCase();
  const than = kind === "bin" ? "than in all genres" : "than all genres";
  return {
    short: `Clearly ${word}`,
    long: `clearly ${word} ${than}`,
    mark: row.f > 0 ? "▲" : "▼",
    word,
  };
}

/** The flagged genres, ordered by the size of the difference (ties A–Z): { up, down } or, for named groups, { mix }. */
export function flagLists(rows, kind) {
  const flagged = rows.filter((r) => !r.all && r.f);
  const bySize = (a, b) => Math.abs(b.r) - Math.abs(a.r) || a.i - b.i;
  if (kind === "grp") return { mix: flagged.sort(bySize), up: [], down: [] };
  return { up: flagged.filter((r) => r.f > 0).sort(bySize), down: flagged.filter((r) => r.f < 0).sort(bySize), mix: [] };
}

/**
 * The genres compared with all genres: those with at least the rule's min_n stories with the characteristic in this
 * option (their r is in the file); the heading's denominator (F63).
 */
export const comparedRows = (rows) => rows.filter((r) => !r.all && r.stats && !r.small);

/**
 * The genres left out of the comparison, A–Z, with their stories: "Too few stories to compare: Chain Stories (12)."
 * (a genre with fewer than meta.min_n stories, whose count the file leaves out: "(fewer than 10)"); null when every
 * genre is compared.
 */
export function tooFewLine(rows, minN) {
  const left = rows.filter((r) => !r.all && (!r.stats || r.small));
  if (!left.length) return null;
  const named = left.map((r) => `${r.genre.name} (${r.stats ? formatCount(r.stats.n) : `fewer than ${minN}`})`);
  return `Too few stories to compare: ${named.join(", ")}.`;
}

/** The heading of one characteristic in every genre: "8 of 30 genres clearly differ from all genres". */
export function chartHeading(count, total) {
  if (!count) return "No genre clearly differs from all genres";
  if (count === 1) return `1 of ${total} genres clearly differs from all genres`;
  return `${count} of ${total} genres clearly differ from all genres`;
}

const join = (names) => names.join(", ");

/**
 * The takeaway's lists (ordered by the size of the difference): [{ mark, word, names }] — "▲ Longer: Novels and
 * Novellas.", "▼ Shorter: …", or "≠ A different mix: …".
 */
export function takeawayLists(rows, variable, kind) {
  const lists = flagLists(rows, kind);
  if (kind === "grp") return lists.mix.length ? [{ mark: "≠", word: "A different mix", names: lists.mix.map((r) => r.genre.name) }] : [];
  const [more, less] = directionWords(variable, kind);
  return [
    lists.up.length && { mark: "▲", word: more, names: lists.up.map((r) => r.genre.name) },
    lists.down.length && { mark: "▼", word: less, names: lists.down.map((r) => r.genre.name) },
  ].filter(Boolean);
}

export const listText = (l) => `${l.mark} ${l.word}: ${join(l.names)}.`;

/** A band's label inside a sentence ("Middle" → "middle"; "2–5" and "1 story" unchanged). */
const bandWord = (variable, b) => lowerFirst(variable.bins.labels[b]);

/**
 * The All genres line, as segments (strings and { strong }): "All genres: median **3,610** words, interquartile
 * range 2,050–6,320. Genre medians run from 1,280 to 5,050." and the forms of the other kinds.
 */
export function allGenresLine(rows, variable, entry) {
  const kind = entry.k;
  const all = rows[0].stats;
  if (!all) return null;
  const genres = rows.filter((r) => !r.all && r.stats);
  const nf = numberFormat(variable, entry);
  if (kind === "num") {
    const segs = ["All genres: median ", { strong: nf.value(all.median) }];
    segs.push(`${nf.unit ? ` ${nf.unit}` : ""}, interquartile range ${nf.span(all.p25, all.p75)}.`);
    if (genres.length >= 2) {
      const meds = genres.map((r) => r.stats.median);
      segs.push(` Genre medians run from ${nf.value(Math.min(...meds))} to ${nf.value(Math.max(...meds))}.`);
    }
    return segs;
  }
  if (kind === "band") {
    const q = bandQuartiles(all.shares);
    const segs = ["All genres: median ", { strong: bandWord(variable, q.median) }];
    // the labels hold dashes ("2–5"), so a range of them reads "1 story to 6–20"
    segs.push(`, interquartile range ${bandWord(variable, q.p25)} to ${bandWord(variable, q.p75)}.`);
    if (genres.length >= 2) {
      const meds = genres.map((r) => bandQuartiles(r.stats.shares).median);
      segs.push(` Genre medians run from ${bandWord(variable, Math.min(...meds))} to ${bandWord(variable, Math.max(...meds))}.`);
    }
    return segs;
  }
  if (kind === "bin") {
    const segs = [`All genres: ${lowerFirst(variable.yes_subject)} make up `, { strong: formatPercent(all.share) }, " of stories."];
    if (genres.length >= 2) {
      const shares = genres.map((r) => r.stats.share);
      segs.push(` Genres run from ${formatPercent(Math.min(...shares))} to ${formatPercent(Math.max(...shares))}.`);
    }
    return segs;
  }
  if (kind === "zero") {
    const segs = ["All genres: ", { strong: formatPercent(all.share) }, " of stories are above 0"];
    if (all.median == null) return [...segs, "."];
    segs.push(`; among those, median ${nf.withUnit(all.median)}, interquartile range ${nf.span(all.p25, all.p75)}.`);
    return segs;
  }
  // named groups: every group's share
  return [`All genres: ${variable.bins.labels.map((l, b) => `${l} ${formatPercent(all.shares[b])}`).join(", ")}.`];
}

/** The genres' median ages in this option, when they differ by `gap` years or more: { lo, hi }, else null. */
export function ageSpread(file, gap = 5) {
  const ages = file.age.slice(1).filter((a) => a != null);
  if (ages.length < 2) return null;
  const lo = Math.min(...ages);
  const hi = Math.max(...ages);
  return hi - lo >= gap - 1e-9 ? { lo, hi } : null;
}

export const ageNoteText = ({ lo, hi }) =>
  `The genres’ stories were published at different times: their median age runs from ${formatFixed(lo, 1)} to ` +
  `${formatFixed(hi, 1)} years.`;

/** The story-age note of one genre, when its median age and all genres' differ by `gap` years or more. */
export function genreAgeNote(file, i, genre, gap = 3) {
  const a = file.age[i];
  const all = file.age[0];
  if (a == null || all == null || Math.abs(a - all) < gap - 1e-9) return null;
  return `Stories in ${genre.name} have a median age of ${formatFixed(a, 1)} years; stories in all genres, ${formatFixed(all, 1)} years.`;
}

// ----------------------------------------------------------------------------------------------------- details
/**
 * A genre's numbers for its details card, details line, row name and table: `items` ([label, value] pairs: the
 * numbers, then Stories and Median age), `comparison` (see comparison(); the card says "Compared with all genres:"
 * and its `short` words), `name` (the row's accessible name) and `line` (the phone's details line, without the
 * genre's name).
 */
export function rowDetails(row, variable, entry, minN) {
  const kind = entry.k;
  const s = row.stats;
  const name = row.genre.name;
  if (!s) return { items: [], comparison: null, name: `${name}: fewer than ${minN} stories`, line: `fewer than ${minN} stories.` };
  const nf = numberFormat(variable, entry);
  const numbers = [];
  const said = [];
  if (kind === "num") {
    const med = nf.withUnit(s.median);
    numbers.push(["Median", med], ["Interquartile range", nf.span(s.p25, s.p75)]);
    said.push(`median ${med}`, `interquartile range ${nf.span(s.p25, s.p75)}`);
  } else if (kind === "zero") {
    numbers.push(["Above 0", formatPercent(s.share)]);
    said.push(`${formatPercent(s.share)} above 0`);
    if (s.median != null) {
      const med = nf.withUnit(s.median);
      numbers.push(["Median above 0", med], ["Interquartile range above 0", nf.span(s.p25, s.p75)]);
      said.push(`among those, median ${med}`, `interquartile range ${nf.span(s.p25, s.p75)}`);
    }
  } else if (kind === "bin") {
    numbers.push(["Share", formatPercent(s.share)]);
    said.push(`${formatPercent(s.share)} ${lowerFirst(variable.yes_subject)}`);
  } else {
    if (kind === "band") {
      const median = variable.bins.labels[bandQuartiles(s.shares).median];
      numbers.push(["Median", median]);
      said.push(`median ${median}`);
    }
    variable.bins.labels.forEach((label, b) => {
      numbers.push([label, formatPercent(s.shares[b])]);
      said.push(`${label} ${formatPercent(s.shares[b])}`);
    });
  }
  const stories = `${formatCount(s.n)} stories`;
  const age = formatYears(row.age);
  const items = [...numbers, ["Stories", formatCount(s.n)], ["Median age", age]];
  const cmp = comparison(row, variable, kind, minN);
  const parts = [...said, stories, `median age ${age}`, ...(cmp ? [cmp.long] : [])];
  return { items, comparison: cmp, name: `${name}: ${parts.join(", ")}`, line: `${parts.join(" · ")}.` };
}

// ------------------------------------------------------------------------------------------------- one genre
/**
 * "One genre" (View 2) for genre index `gi`: every characteristic of the file (browsing order) with its flag,
 * { lower, higher, mix } (flagged, ordered by the size of the difference; ties in browsing order), how many were
 * compared, and the topics (meta.topics' order) with their characteristics, how many stand out and how many were
 * compared.
 */
export function genreProfile(meta, file, gi) {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const order = meta.topics.flatMap((t) => t.ids).filter((id) => file.c[id] && byId.has(id));
  const items = order.map((id, pos) => {
    const entry = file.c[id];
    return {
      id,
      pos,
      variable: byId.get(id),
      entry,
      nf: numberFormat(byId.get(id), entry),
      kind: entry.k,
      stats: cellStats(entry, gi),
      all: cellStats(entry, 0),
      r: entry.r[gi],
      f: entry.f[gi],
    };
  });
  const bySize = (a, b) => Math.abs(b.r) - Math.abs(a.r) || a.pos - b.pos;
  const flagged = items.filter((x) => x.f);
  // compared: the characteristics with at least the rule's min_n stories in the genre (their r is in the file)
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

/** "28 characteristics clearly set Romance apart from all genres". */
export function profileHeading(count, genre) {
  if (!count) return `No characteristic clearly sets ${genre.name} apart from all genres`;
  if (count === 1) return `1 characteristic clearly sets ${genre.name} apart from all genres`;
  return `${count} characteristics clearly set ${genre.name} apart from all genres`;
}

/** What a characteristic is called in a sentence: its noun, or for yes/no ones their subject ("first-person stories"). */
export const nounOf = (variable) => (variable.yes_subject ? lowerFirst(variable.yes_subject) : variable.noun);

/** The word for one stand-out in the takeaway: the D10 word in lower case, else lower/higher, more/less common, different mix. */
export function standOutWord(item) {
  if (item.kind === "grp") return "different mix";
  const [more, less] = directionWords(item.variable, item.kind);
  return (item.f > 0 ? more : less).toLowerCase();
}

/** "Biggest differences: sexual language (less), …" for the three largest. */
export function profileTakeaway(flagged) {
  if (!flagged.length) return null;
  const top = flagged.slice(0, 3).map((x) => `${nounOf(x.variable)} (${standOutWord(x)})`);
  return `${top.length === 1 ? "Biggest difference" : "Biggest differences"}: ${top.join(", ")}.`;
}

/** The group whose share differs most between a genre and all genres (named groups and bands). */
export function biggestGap(stats, all) {
  let best = 0;
  stats.shares.forEach((s, b) => {
    if (Math.abs(s - all.shares[b]) > Math.abs(stats.shares[best] - all.shares[best])) best = b;
  });
  return best;
}

/**
 * A characteristic's values in one genre and in all genres, for "One genre": "7.79 · all 19.3", "24% · all 27%",
 * "73% above 0 · all 43%", "6–20 · all 2–5", "Second person (you) 55% · all 2%".
 */
export function profileValues(item) {
  const { kind, stats: g, all: a, variable } = item;
  if (!g || !a) return "";
  if (kind === "num") return `${item.nf.value(g.median)} · all ${item.nf.value(a.median)}`;
  if (kind === "bin") return `${formatPercent(g.share)} · all ${formatPercent(a.share)}`;
  if (kind === "zero") return `${formatPercent(g.share)} above 0 · all ${formatPercent(a.share)}`;
  if (kind === "band") {
    const labels = variable.bins.labels;
    return `${labels[bandQuartiles(g.shares).median]} · all ${labels[bandQuartiles(a.shares).median]}`;
  }
  const b = biggestGap(g, a);
  return `${variable.bins.labels[b]} ${formatPercent(g.shares[b])} · all ${formatPercent(a.shares[b])}`;
}

/** How one stand-out compares, at the end of a row's name: "clearly lower", "no clear difference". */
function profileComparison(item, small) {
  if (small) return "too few stories to compare";
  if (!item.f) return "no clear difference";
  if (item.kind === "grp") return "a clearly different mix";
  return `clearly ${standOutWord(item)}`;
}

/**
 * What a row in "One genre" says after its visible label and values, for screen readers (its accessible name starts
 * with what is on screen, F76): "Romance median 7.79 per 1,000 words, interquartile range 4.1–12.2; all genres median
 * 19.3, interquartile range 9.82–31.4; clearly less. Opens every genre’s numbers."
 */
export function profileRowDescription(item, genre, small, minN) {
  const { kind, stats: g, all: a, variable, nf } = item;
  const describe = (s) => {
    if (!s) return `fewer than ${minN} stories`;
    if (kind === "num") return `median ${nf.withUnit(s.median)}, interquartile range ${nf.span(s.p25, s.p75)}`;
    if (kind === "bin") return formatPercent(s.share);
    if (kind === "zero") {
      const among = s.median == null ? "" : `, median ${nf.withUnit(s.median)} among them`;
      return `${formatPercent(s.share)} above 0${among}`;
    }
    if (kind === "band") {
      const q = bandQuartiles(s.shares);
      const L = variable.bins.labels;
      return `median ${L[q.median]}, interquartile range ${L[q.p25]} to ${L[q.p75]}`;
    }
    return variable.bins.labels.map((l, b) => `${l} ${formatPercent(s.shares[b])}`).join(", ");
  };
  return `${genre.name} ${describe(g)}; all genres ${describe(a)}; ${profileComparison(item, small)}. Opens every genre’s numbers.`;
}

// -------------------------------------------------------------------------------------------- the range chart
/**
 * The rows of the range chart (num) or the share chart (bin) for rangeLayout(): a genre's interquartile range and
 * median, or a bar from 0 to its share; the mark of a genre that clearly differs.
 */
export function chartRows(rows, variable, kind) {
  return rows.map((row) => {
    const s = row.stats;
    let stats = null;
    if (s) stats = kind === "bin" ? { n: s.n, p25: 0, median: s.share, p75: s.share } : { n: s.n, p25: s.p25, median: s.median, p75: s.p75 };
    return { index: row.i, label: row.genre.name, stats, mark: comparison(row, variable, kind)?.mark || "" };
  });
}

/**
 * The value axis of the range chart: from the lowest quartile to the highest (with 4% to spare), starting at 0 when
 * the lowest is near it (within half the span); shares run from 0 to 100%.
 */
export function chartDomain(rows, kind) {
  if (kind === "bin") return [0, 1];
  const vals = rows.filter((r) => r.stats).flatMap((r) => [r.stats.p25, r.stats.median, r.stats.p75]);
  if (!vals.length) return [0, 1];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.04 || Math.abs(hi) * 0.04 || 1;
  lo = lo >= 0 && lo <= (hi - lo) / 2 ? 0 : lo - pad;
  return [lo, hi + pad];
}

/** Axis labels for percentages ("25%") and years ("2010"); null keeps the chart's own. */
export function tickFormatFor(kind, fmt) {
  if (kind === "bin" || fmt === "percent") {
    return (v, step) => `${formatFixed(v * 100, stepDecimals(step * 100))}%`;
  }
  if (fmt === "year") return (v) => (Number.isInteger(Math.round(v * 1e6) / 1e6) ? String(Math.round(v)) : "");
  return null;
}

/** The value printed in a row's column: the median (as the chart prints its numbers), or the share. */
export const printedFor = (kind, nf) => (stats) => (kind === "bin" ? formatPercent(stats.median) : nf.value(stats.median));

/** The heading of a characteristic's rows: the genres that clearly differ, of those compared (F63). */
export const rowsHeading = (rows) => chartHeading(rows.filter((r) => !r.all && r.f).length, comparedRows(rows).length);

/**
 * What screen readers hear for one characteristic: the heading, then the takeaway's lists, All genres line and the
 * genres with too few stories to compare.
 */
export function chartAnnouncement(meta, file, variable) {
  const entry = file.c[variable.id];
  if (!entry) return "";
  const rows = genreRows(meta, file, variable.id);
  const lists = takeawayLists(rows, variable, entry.k).map(listText);
  const all = allGenresLine(rows, variable, entry);
  return [
    `${rowsHeading(rows)}.`,
    ...lists,
    all ? all.map((s) => (typeof s === "string" ? s : s.strong)).join("") : "",
    tooFewLine(rows, meta.min_n),
  ]
    .filter(Boolean)
    .join(" ");
}
