// The Genres page's pure helpers: reading genres/<included>.json (see data.js), the numbers' formats, and every
// sentence the page says. A genre "clearly differs" only through the file's flags (`f`, the rule in meta.genre_rule);
// nothing here ranks genres, except the "By median" order the reader asks for (D3).

import { formatCount, formatFixed, stepDecimals } from "./format.js";
import { textWidth } from "./rangeLayout.js";
import { TEXT } from "./tokens.js";
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

/**
 * A row's two shares in "One genre" and "What changed" (section 4.2): as formatPercent writes them, or both with one
 * decimal when they would print the same but differ ("18.4%" and "18.2%", not "18%" twice).
 */
export function sharePair(g, a) {
  const texts = [formatPercent(g), formatPercent(a)];
  if (g == null || a == null || g === a || texts[0] !== texts[1]) return texts;
  const one = (v) => (Math.abs(v) >= 0.0005 ? `${formatFixed(v * 100, 1)}%` : formatPercent(v));
  return [one(g), one(a)];
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
 * line, the dashed line's label, the details and the row names, and View 2's values and row names.
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

/**
 * The unit written after a number, when it is a plain unit (words, per 1,000 words, letters, names …): ranges only,
 * no parentheses, not a share, yes/no, "1 =", position or year, and a plural or a rate ("part" and "US school grade"
 * are left out); never for percentages, years or scales. Unlike unitNote() in wording.js it is kept when the noun names
 * the unit too, so word count reads "3,610 words".
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
 * One row per genre (all genres first), in the file's order (meta.genres: A–Z): { i, genre, all, stats, small, r, f }.
 * `small`: fewer than the rule's min_n stories (drawn as uncertain, never flagged).
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
    };
  });
}

/** The value genres are put in order by (D3): the median, the share, or the share of stories with any. */
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
export const orderLabel = (kind) => (kind === "bin" ? "By share" : kind === "zero" ? "By share with any" : "By median");

/** Can a form's genres be put in order of their values (D3)? Numbers, yes/no and mostly zero; not named groups or bands. */
export const sortableKind = (kind) => kind === "num" || kind === "bin" || kind === "zero";

/**
 * The order line's words (F75): "Genres in alphabetical order", or by the toggle's value "Genres by median, highest
 * first" (yes/no: "by share"; mostly zero: "by share with any"). Named groups and bands are always A–Z.
 */
export function orderWords(kind, sort) {
  if (sort !== "value" || !sortableKind(kind)) return "Genres in alphabetical order";
  if (kind === "bin") return "Genres by share, highest first";
  if (kind === "zero") return "Genres by share with any, highest first";
  return "Genres by median, highest first";
}

// ----------------------------------------------------------------------------------------------- comparisons, words
/** The words for a genre that clearly differs (D10): the characteristic's own, else Higher / Lower (yes/no: More / Less common). */
export function directionWords(variable, kind) {
  if (variable.more_word && variable.less_word) return [variable.more_word, variable.less_word];
  return kind === "bin" ? ["More common", "Less common"] : ["Higher", "Lower"];
}

/**
 * How a genre compares with all genres, in words: `short` for the details card ("Clearly shorter",
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
    const median = nf.value(all.median);
    const segs = ["All genres: median ", { strong: median }];
    // the unit after the number in bold, singular after exactly "1" ("median 1 page")
    segs.push(`${withUnit(median, nf.unit).slice(median.length)}, interquartile range ${nf.span(all.p25, all.p75)}.`);
    if (genres.length >= 2) {
      const meds = genres.map((r) => r.stats.median);
      const [lo, hi] = [nf.value(Math.min(...meds)), nf.value(Math.max(...meds))];
      if (lo !== hi) segs.push(` Genre medians run from ${lo} to ${hi}.`); // never "from 1 to 1" (F72)
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
      const [lo, hi] = [Math.min(...meds), Math.max(...meds)];
      if (lo !== hi) segs.push(` Genre medians run from ${bandWord(variable, lo)} to ${bandWord(variable, hi)}.`);
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
    const segs = ["All genres: ", { strong: formatPercent(all.share) }, " of stories have any"];
    if (all.median == null) return [...segs, "."];
    segs.push(`; among those, median ${nf.withUnit(all.median)}, interquartile range ${nf.span(all.p25, all.p75)}.`);
    return segs;
  }
  // named groups: every group's share
  return [`All genres: ${variable.bins.labels.map((l, b) => `${l} ${formatPercent(all.shares[b])}`).join(", ")}.`];
}

// ----------------------------------------------------------------------------------------------------- details
/**
 * A genre's numbers for its details card, details line and row name: `items` ([label, value] pairs: the
 * numbers, then Stories), `comparison` (see comparison(); the card says "Compared with all genres:" and its `short`
 * words), `name` (the row's accessible name) and `line` (the phone's details line, without the genre's name).
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
    numbers.push(["With any", formatPercent(s.share)]);
    said.push(`${formatPercent(s.share)} with any`);
    if (s.median != null) {
      const med = nf.withUnit(s.median);
      numbers.push(["Median among those", med], ["Interquartile range among those", nf.span(s.p25, s.p75)]);
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
  const items = [...numbers, ["Stories", formatCount(s.n)]];
  const cmp = comparison(row, variable, kind, minN);
  const parts = [...said, `${formatCount(s.n)} stories`, ...(cmp ? [cmp.long] : [])];
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
      zone: noDifferenceZone(file.rule),
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

/**
 * What a characteristic measures, under one characteristic's heading on the Genres and Trends pages (meta's
 * description), or null when a description only repeats the label and the unit (as "Touch words per 1,000 words." did
 * before meta.json defined them): it would look like a definition and give none.
 */
export function whatItMeasures(variable) {
  const d = variable.description;
  if (!d) return null;
  const plain = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const said = plain(d);
  return said === plain(variable.label) || said === plain(`${variable.label} ${variable.unit || ""}`) ? null : d;
}

/** The word for one stand-out in the takeaway: the D10 word in lower case, else lower/higher, more/less common, different mix. */
export function standOutWord(item) {
  if (item.kind === "grp") return "different mix";
  const [more, less] = directionWords(item.variable, item.kind);
  return (item.f > 0 ? more : less).toLowerCase();
}

/** The direction words that name a position, not an amount (where something starts or peaks: D10's "Later" …). */
export const POSITION_WORDS = ["Later", "Earlier", "Sooner"];

/** A stand-out's position word ("Later", "Earlier", "Sooner"), or null when its words are Higher / Lower and the like. */
export function positionWord(item) {
  if (item.kind === "grp" || !item.f) return null;
  const [more, less] = directionWords(item.variable, item.kind);
  const word = item.f > 0 ? more : less;
  return POSITION_WORDS.includes(word) ? word : null;
}

/**
 * The takeaway (concept S1, F90): a line per list that has items, in the lists' order, each naming its first three as
 * the list words them (`lowerFirst(label)`): [{ mark: "▲", word: "Higher", items: ["romance language", …] }, { mark:
 * "▼", word: "Lower", … }, { mark: "≠", word: "A different mix", … }]. A characteristic whose words name a position is
 * listed under its own word (round 4's W1): "▲ Later: where the first sex scene starts.", "▼ Earlier: …", "▼ Sooner:
 * …", after the line of its own direction; the lists below keep their titles. Story age is the publication year again,
 * so it is left out when publication year is among the items shown, and the next one is taken (F78); a line left with
 * nothing goes. Empty when nothing stands out.
 */
export function profileTakeaway(p) {
  const year = [p.lower, p.higher, p.mix].some((list) => list.slice(0, 3).some((x) => x.id === "pub_year"));
  const named = (list) => list.filter((x) => !(year && x.id === "age_years")).slice(0, 3).map((x) => lowerFirst(x.variable.label));
  const amounts = (list) => list.filter((x) => !positionWord(x));
  const at = (list, word) => list.filter((x) => positionWord(x) === word);
  // higher first, as the lists are (the owner, 2026-10-13)
  return [
    { mark: "▲", word: "Higher", items: named(amounts(p.higher)) },
    { mark: "▲", word: "Later", items: named(at(p.higher, "Later")) },
    { mark: "▼", word: "Lower", items: named(amounts(p.lower)) },
    { mark: "▼", word: "Earlier", items: named(at(p.lower, "Earlier")) },
    { mark: "▼", word: "Sooner", items: named(at(p.lower, "Sooner")) },
    { mark: "≠", word: "A different mix", items: named(p.mix) },
  ].filter((line) => line.items.length);
}

/** A takeaway line's words, without its mark: "Lower: sexual language, sentences with sexual language, …." */
export const takeawayLine = (line) => `${line.word}: ${line.items.join(", ")}.`;

/** The group whose share differs most between a genre and all genres (named groups and bands). */
export function biggestGap(stats, all) {
  let best = 0;
  stats.shares.forEach((s, b) => {
    if (Math.abs(s - all.shares[b]) > Math.abs(stats.shares[best] - all.shares[best])) best = b;
  });
  return best;
}

/**
 * A number with the trailing zeros of its decimals dropped, on its own ("1.720" → "1.72", "10.0" → "10", "2.0%" →
 * "2%"; "4,390" and "0.05" stay): "One genre"'s columns and row names only (F85, quick win 3). View 1 keeps one number
 * of decimals per chart (F66).
 */
export const trimZeros = (text) => text.replace(/(\d)\.(\d*?)0+(?=\D|$)/g, (_, d, kept) => (kept ? `${d}.${kept}` : d));

// unit texts that are not a unit to print under a label: shares, yes/no, "1 = …", and publication month and weekday
const NOT_A_UNIT = /^(share|yes\/no|1 =|month \(|0 = Monday)/;

// what a named group's shares are of: each story counts once, in one group
const OF_STORIES = "% of stories";

/**
 * The unit under a number's label in "One genre" (decision 7): the plain unit ("per 1,000 words", "words"), else the
 * data's own unit text where it explains a scale ("Zipf scale (higher = more common)", "ratio (1 = random order)"),
 * with "position (0 = start, 1 = end)" as "of the way through the story"; never a share, yes/no, "1 =", a list of
 * groups (" / ") or the month and weekday units, and never a unit the label names already ("Sex scenes per 10,000
 * words", "Years online", "Publication year", "Part number"). "" for none.
 */
export function profileUnit(item) {
  const { variable, nf } = item;
  const text = variable.unit || "";
  let unit = nf.unit;
  if (!unit && text && !NOT_A_UNIT.test(text) && !text.includes(" / ")) {
    unit = text === "position (0 = start, 1 = end)" ? "of the way through the story" : text;
  }
  return unit && !variable.label.toLowerCase().includes(unit.toLowerCase()) ? unit : "";
}

/**
 * Does a stand-out with most stories at 0 have a share with any on the other side of all genres' from its dot? (F61b,
 * decision 6): its columns then add the medians among those with any, so the share can't mislead.
 */
const otherWay = (item) =>
  item.kind === "zero" && Boolean(item.f) && Math.sign(item.stats.share - item.all.share) !== Math.sign(item.r);

const atDecimals = (v, d) => formatFixed(v, d);
const significant = (text) => text.replace(/[^0-9]/g, "").replace(/^0+/, "").length;

/**
 * Two numbers side by side in a row of "One genre" (round 4's W1), with the same decimals: as many as give the larger
 * of the two three significant digits, and more while the smaller (above 0) would show fewer than two, both taking the
 * extra decimal; then a last decimal that both end on a 0 is dropped, so a trailing zero stays only where the other
 * value needs that decimal: "7.8 vs 19.3", "10.0 vs 3.8", "2.32 vs 5.75", "309 vs 137". [genre's, all genres'], "–" for
 * a missing one.
 */
export function pairText(g, a) {
  const vals = [g, a].filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return ["–", "–"];
  const big = Math.max(...vals.map(Math.abs));
  const small = Math.min(...vals.map(Math.abs));
  let d = big > 0 ? Math.max(0, 2 - Math.floor(Math.log10(big))) : 0;
  while (small > 0 && significant(atDecimals(small, d)) < 2 && d < 6) d += 1;
  const ends0 = (v) => v == null || !Number.isFinite(v) || atDecimals(v, d).endsWith("0");
  while (d > 0 && ends0(g) && ends0(a)) d -= 1;
  const text = (v) => (v == null || !Number.isFinite(v) ? "–" : atDecimals(v, d));
  return [text(g), text(a)];
}

/**
 * The two number columns of a row in "One genre" (concept R3, F85): { genre, all, unit }, `genre` and `all` each [main,
 * second?] (null without the genre's numbers: fewer than meta.min_n stories with it), and the unit line under the
 * label.
 * - Numbers: the medians, with the same decimals (pairText: "7.8" and "19.3"; percentages and years as the chart
 *   prints them), with profileUnit(). "What changed" (`pair: false`) keeps each trimmed of trailing zeros on its own.
 * - Yes/no: the shares, no unit line.
 * - Mostly zero: the shares with any, "stories with any"; a stand-out whose share goes the other way from its dot
 *   adds the medians among those ("–" for none), "with any · median among those" with its plain unit.
 * - Bands: the median bands, "median". Named groups: the shares of the group that differs most, under its name
 *   (`group`: its index, for the swatch of its color before the name), then "% of stories" (`of`): each story counts
 *   once, in one group.
 */
export function profileColumns(item, { pair = true } = {}) {
  const { kind, stats: g, all: a, variable, nf } = item;
  const num = (v) => (v == null ? "–" : trimZeros(nf.value(v)));
  // the genre's and all genres' medians, with the same decimals where they are plain numbers (not percentages or years)
  const both = (gv, av) => (pair && nf.fmt === "num" ? pairText(gv, av) : [num(gv), num(av)]);
  if (kind === "num") {
    const [gm, am] = both(g?.median, a?.median);
    return { genre: g && [gm], all: a && [am], unit: profileUnit(item) };
  }
  // the two shares, both with one decimal where they would print the same but differ (sharePair)
  const [gs, as] = g && a && g.share != null ? sharePair(g.share, a.share) : [g && formatPercent(g.share), a && formatPercent(a.share)];
  if (kind === "bin") return { genre: g && [gs], all: a && [as], unit: "" };
  if (kind === "zero") {
    if (g && a && otherWay(item)) {
      const unit = profileUnit(item);
      const [gm, am] = both(g.median, a.median);
      return {
        genre: [gs, gm],
        all: [as, am],
        unit: `with any\u00a0·\u00a0median among those${unit ? `, ${unit}` : ""}`, // never a line that starts or ends with "·"
      };
    }
    return { genre: g && [gs], all: a && [as], unit: "stories with any" };
  }
  if (kind === "band") {
    const median = (s) => s && [variable.bins.labels[bandQuartiles(s.shares).median]];
    return { genre: median(g), all: median(a), unit: "median" };
  }
  if (!g || !a) return { genre: null, all: null, unit: "" };
  const b = biggestGap(g, a);
  const [gb, ab] = sharePair(g.shares[b], a.shares[b]);
  return {
    genre: [gb],
    all: [ab],
    unit: variable.bins.labels[b],
    group: b,
    of: OF_STORIES,
  };
}

/**
 * A row's mark in "One genre" (concept R3): how often the genre's story is the higher one against a story from all
 * genres, out of 100: 50 × (1 + r), the rank-biserial r the rule decides by. A stem runs from 50 to there (`from`, `to`),
 * with a dot at its end (`end`) and its number (`times`, rounded away from 50: r of ±0.25 reads 63 and 37). A clear
 * difference (`flagged`) never prints the edge of the `zone` of no clear difference: its number goes one step outward
 * (r −0.206 reads 39, not 40; section 4.2). Null when r is null (fewer than the rule's min_n stories: nothing was
 * compared).
 */
export function comparisonBar(r, { flagged = false, zone = null } = {}) {
  if (r == null) return null;
  const end = 50 * (1 + r);
  const times = 50 + Math.sign(r) * Math.round(50 * Math.abs(r));
  const edge = flagged && zone && (times === zone[0] || times === zone[1]);
  return {
    times: edge ? times + Math.sign(r) : times,
    from: Math.min(50, end),
    to: Math.max(50, end),
    end,
    lower: r < 0,
  };
}

/** The zone of "no clear difference" on that scale, from the rule (40 to 60 in 100 for min_r 0.2). */
export const noDifferenceZone = (rule) => [Math.round(50 * (1 - rule.min_r)), Math.round(50 * (1 + rule.min_r))];

/**
 * Where a row's number goes (F83, quick win 1): beside its dot on the side away from 50 (a dot at 50 counts as higher),
 * `gap` px from the dot's edge; a dot inside the zone of no clear difference has its number `gap` px outside the zone's
 * edge on the dot's side, so no number sits on a line; near the scale's ends, a number that would pass the plot's edge
 * goes on the dot's inner side (its halo over the stem). `plotW`: the plot's width, `dotR`: the dot's radius and
 * `textW`: the number's width, in px; `scale`: { lo, hi } when the plot shows part of the 0–100 scale ("What changed"'s
 * zoomed scale), else all of it. Returns { x (percent of the plot), dx (px), anchor ("start" or "end") }.
 */
export function numberPlace(r, zone, { plotW, dotR, textW, gap = 8, scale = null }) {
  const pct = scale ? (v) => ((v - scale.lo) / (scale.hi - scale.lo)) * 100 : (v) => v;
  const end = 50 * (1 + r);
  const left = r < 0;
  if (end > zone[0] && end < zone[1]) return left ? { x: pct(zone[0]), dx: -gap, anchor: "end" } : { x: pct(zone[1]), dx: gap, anchor: "start" };
  const off = dotR + gap;
  const at = (pct(end) / 100) * plotW;
  const passes = left ? at - off - textW < 0 : at + off + textW > plotW;
  return left !== passes ? { x: pct(end), dx: -off, anchor: "end" } : { x: pct(end), dx: off, anchor: "start" };
}

/** How one row compares, at the end of its name: "clearly less", "no clear difference", "too few stories to compare". */
function profileComparison(item) {
  if (item.r == null) return "too few stories to compare";
  if (!item.f) return "no clear difference";
  if (item.kind === "grp") return "a clearly different mix";
  return `clearly ${standOutWord(item)}`;
}

/**
 * A row's accessible name in "One genre" (F92), built from what the row shows: its label, then the dot's number, the
 * two columns' numbers in reading order and the unit (after all genres' number, once: "1 page"), then the comparison:
 * "Sexual language: 26 in 100; Romance 7.8, all genres 19.3 per 1,000 words; clearly less. Opens every genre’s
 * numbers." Not compared: no number of the dot ("…; too few stories to compare."), and "fewer than 10 stories" for
 * the genre without its numbers. Mostly zero: "Romance 73% with any, all genres 43%", with "; among those, median
 * 0.709 and 0.422 per 1,000 words" where the medians show. Bands: "Romance median 6–20, all genres median 2–5". Named
 * groups: "% of stories", then every group's share in both ("a clearly different mix").
 */
export function profileRowName(item, genre, minN) {
  const { kind, stats: g, all: a, variable, nf } = item;
  const cols = profileColumns(item);
  const end = `; ${profileComparison(item)}. Opens every genre’s numbers.`;
  const bar = comparisonBar(item.r, { flagged: Boolean(item.f), zone: item.zone });
  const times = item.r == null || kind === "grp" ? "" : ` ${bar.times} in 100;`;
  const few = `fewer than ${minN} stories`;
  if (kind === "grp") {
    // each group's two shares as the columns print theirs (sharePair)
    const pairs = g && a && variable.bins.labels.map((_, b) => sharePair(g.shares[b], a.shares[b]));
    const shares = (s, k) =>
      s ? variable.bins.labels.map((l, b) => `${l} ${pairs ? pairs[b][k] : formatPercent(s.shares[b])}`).join(", ") : few;
    return `${variable.label}, ${OF_STORIES}: ${genre.name} ${shares(g, 0)}; all genres ${shares(a, 1)}${end}`;
  }
  const genreN = cols.genre ? cols.genre[0] : few;
  const allN = cols.all ? cols.all[0] : few;
  if (kind === "band") {
    const median = (n) => (n === few ? n : `median ${lowerFirst(n)}`);
    return `${variable.label}:${times} ${genre.name} ${median(genreN)}, all genres ${median(allN)}${end}`;
  }
  if (kind === "zero") {
    let among = "";
    if (cols.genre?.[1]) {
      const unit = profileUnit(item);
      const [gm, am] = [cols.genre[1], cols.all[1]];
      if (gm !== "–" && am !== "–") among = `; among those, median ${gm} and ${withUnit(am, unit)}`;
      else if (am !== "–") among = `; among those, median ${withUnit(am, unit)} in all genres`;
      else if (gm !== "–") among = `; among those, median ${withUnit(gm, unit)} in ${genre.name}`;
    }
    const withAny = cols.genre ? `${genreN} with any` : genreN;
    return `${variable.label}:${times} ${genre.name} ${withAny}, all genres ${allN}${among}${end}`;
  }
  const unit = kind === "num" ? cols.unit : "";
  // a scale's text that starts with a number follows a comma ("0.468, −1 (all negative) to +1 (all positive)")
  const all = !cols.all ? allN : /^[−+\d]/.test(unit) ? `${allN}, ${unit}` : withUnit(allN, unit);
  return `${variable.label}:${times} ${genre.name} ${genreN}, all genres ${all}${end}`;
}

/**
 * What a sample of stories is called under "One genre"'s heading (F93): "300 stories in Romance.", or with another
 * option "100 stories in Romance match “Published 2020 or later”.".
 */
export const sampleLine = (n, genre, subset) =>
  `${formatCount(n)} stories in ${genre.name}${subset.id === "all" ? "" : ` match “${subset.label}”`}.`;

/**
 * A genre's name that a narrow line may break after its slash ("Reluctance/" "NonConsent"), with a zero-width space,
 * which screen readers don't say: the genre select's word, "One genre"'s list titles and its wide heads.
 */
export const breakable = (name) => name.replace(/\//g, "/\u200b");

/**
 * The axis title over the first list's rows (F86): what a dot's number is, in the Trends page's words (round 4's W1),
 * with "out of 100" kept on one line.
 */
export const axisTitle = (genre) =>
  `How often a story in ${genre.name} comes out higher than a story from all genres, out\u00a0of\u00a0100`;

/**
 * Which of a named group's two bars is the genre's (quick win 5): "A different mix: Romance above, all genres below" over
 * the "A different mix" list's rows; "Romance above, all genres below" right over each named-group row in an open topic
 * (`inTopic`), where nothing may differ.
 */
export const mixLine = (genre, { inTopic = false } = {}) =>
  `${inTopic ? "" : "A different mix: "}${genre.name} above, all genres below`;

/**
 * The note above the first list (round 4's W1, where the Trends page's note is, in its words), in three parts, the
 * middle one the link to how a difference is decided (never broken inside): "Each dot compares a story in Romance with
 * a story from all genres, counting every story, not only the medians (50 is a tie; " · "how this is decided" · ").
 * Tap a row for every genre’s numbers." ("Click" on a device that can hover, `tap` false). The gray dots are the
 * topics' line's to explain, over the topics. In an open topic, when no list is shown, the same words (`inTopic`).
 */
export function profileNote(genre, { tap = false } = {}) {
  return [
    `Each dot compares a story in ${genre.name} with a story from all genres, counting every story, not only the medians (50 is a tie; `,
    "how\u00a0this\u00a0is\u00a0decided",
    `). ${tap ? "Tap" : "Click"} a row for every genre’s numbers.`,
  ];
}

/**
 * The heads of the two number columns: wide, the genre's name in up to two lines of `width` px (12 px, 600; a line may
 * break at a space or after a slash, which gets a zero-width space: "Taboo/" "Incest") and "All genres"; stacked, the
 * name on one line of `width` px and "All"; "Genre" when the name doesn't fit.
 */
export function profileHeads(genre, stacked, width) {
  const fits = (t) => textWidth(t, TEXT.tick, 600) <= width;
  if (stacked) return [fits(genre.name) ? genre.name : "Genre", "All"];
  let lines = 0;
  let line = "";
  // the pieces a line may break between, each with what joins it to the previous one
  for (const [, join, piece] of genre.name.matchAll(/(^|\s|(?<=\/))([^\s/]+\/?)/g)) {
    if (!fits(piece)) lines = Infinity;
    else if (line && fits(`${line}${join}${piece}`)) line = `${line}${join}${piece}`;
    else [line, lines] = [piece, lines + 1];
  }
  return [lines <= 2 ? genre.name.replace(/\//g, "/​") : "Genre", "All genres"];
}

/**
 * A topic's count (F89), never worded two ways: "1 of 28 stand out" ({ k, m, text }) whenever any was compared, "0 of 13"
 * included, else "13 characteristics" ({ n, text }).
 */
export function topicCount(t) {
  if (t.compared) return { k: t.count, m: t.compared, text: `${t.count} of ${t.compared} stand out` };
  const n = t.items.length;
  return { n, text: `${n} characteristic${n === 1 ? "" : "s"}` };
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
