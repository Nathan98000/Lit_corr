// Plain-English titles and notes for every chart.
//
// A title states a pattern ("Longer stories tend to get more favorites per 1,000 views") only when the
// aggregates mark it as clear (direction +1 / -1, see litcorr/stage2/site_data.py). Otherwise it is neutral
// ("How favorites per 1,000 views vary with story length"). Titles use descriptive verbs only: never
// "cause", "drive", "make readers" and the like.

export function lowerFirst(s) {
  if (!s) return s;
  const first = s.split(" ")[0];
  if (first === "I" || first === first.toUpperCase() || /^['‘“-]/.test(first)) return s;
  return s[0].toLowerCase() + s.slice(1);
}

export function upperFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function strengthWord(effect) {
  const a = Math.abs(effect ?? 0);
  if (a < 0.2) return "weak";
  if (a < 0.4) return "moderate";
  return "strong";
}

/**
 * A measure where it starts a noun phrase in a sentence: a singular measure takes "the" ("How the average rating
 * varies with …"), a plural one does not ("How favorites per 1,000 views vary with …").
 */
export function theMeasure(metric) {
  return metric.plural ? metric.noun : `the ${metric.noun}`;
}

function where(genre) {
  return genre.id === "all" ? " across all genres" : ` in ${genre.name}`;
}

function inGenre(genre, sentence) {
  return genre.id === "all" ? upperFirst(sentence) : `In ${genre.name}, ${lowerFirst(sentence)}`;
}

/** The chart title. `direction` is the pattern direction for this genre and measure. */
export function chartTitle({ variable, metric, genre, direction, compare = false }) {
  const verb = metric.plural ? "vary" : "varies";
  const binary = Boolean(variable.yes_subject);
  if (compare) {
    if (binary) return `How ${theMeasure(metric)} ${verb} between ${lowerFirst(variable.yes_subject)} and ${variable.no_subject}, genre by genre`;
    return `How ${theMeasure(metric)} ${verb} ${variable.bins.ordered ? "with" : "by"} ${variable.noun}, genre by genre`;
  }
  if (direction && binary) {
    const what = direction > 0 ? metric.more : metric.less;
    return inGenre(genre, `${variable.yes_subject} tend to ${what} than ${variable.no_subject}`);
  }
  if (direction && variable.bins.ordered) {
    const what = direction > 0 ? metric.more : metric.less;
    return inGenre(genre, `${variable.more} tend to ${what}`);
  }
  if (binary) {
    return `How ${theMeasure(metric)} ${verb} between ${lowerFirst(variable.yes_subject)} and ${variable.no_subject}${where(genre)}`;
  }
  if (!variable.bins.ordered) return `How ${theMeasure(metric)} ${verb} by ${variable.noun}${where(genre)}`;
  return `How ${theMeasure(metric)} ${verb} with ${variable.noun}${where(genre)}`;
}

/**
 * The sentence after the takeaway's medians on how clear the pattern is (F40), as segments: plain strings and
 * { strength } for the strength word (the page links it to its definition). Null for characteristics without an
 * order, whose heading already says that each group stands on its own. `shown` is the number of groups with enough
 * stories; `smallN` the size both end groups need before a pattern is judged.
 */
export function patternNote({ variable, direction, effect, compare = false, shown = null, smallN = 30 }) {
  if (!compare && shown != null && shown < 2) {
    return ["Only one group has enough stories for this selection, so there is nothing to compare. Try “All stories” or All genres."];
  }
  if (!variable.bins.ordered && !variable.yes_subject) return null;
  if (compare) {
    return ["Arrows mark the genres where the pattern is clear enough to describe; a dash means no clear pattern."];
  }
  if (effect == null) return [`A pattern is judged only when the groups at both ends have at least ${smallN} stories.`];
  if (direction) {
    return ["A ", { strength: strengthWord(effect) }, " pattern; individual stories vary a lot within every group."];
  }
  return ["The groups differ only a little, or not consistently."];
}

// Totals and the measure that makes old and new stories easier to compare.
export const RATE_FOR = {
  pop_views: "pop_views_per_month",
  pop_favorites: "pop_fav_per_1k_views",
  pop_comments: "pop_comments_per_1k_views",
  pop_rating_count: "pop_ratings_per_1k_views",
};

/**
 * Story-age warnings, shown as boxes: { kind: "total" } when the measure is a total that grows with time online,
 * and { kind: "groups" } when the end groups differ a lot in age. Each has a bold lead and a sentence.
 */
export function ageNotes({ metric, ends }) {
  const notes = [];
  if (ends) {
    const [a, b] = ends.map((r) => r.stats.age);
    if (a != null && b != null) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi - lo >= 2 && hi >= 1.4 * Math.max(lo, 0.5)) {
        notes.push({
          kind: "groups",
          lead: "Story age.",
          text:
            `The groups also differ in age: stories in “${ends[0].label}” have a median age of ${fmtYears(a)}, ` +
            `those in “${ends[1].label}” ${fmtYears(b)}. Age goes with popularity too, so it can shape this chart.`,
        });
      }
    }
  }
  if (metric.age) {
    notes.push({
      kind: "total",
      lead: "Totals grow with time online.",
      text: `Older stories have had longer to collect ${metric.noun}.`,
    });
  }
  return notes;
}

/** The section of “How it works” that explains how a characteristic was measured. */
export function methodSection(variable) {
  const id = variable.id;
  if (/^(pov_|narr_|reader_address)/.test(id)) return "point-of-view";
  if (/^(sex_|pace_sex_)/.test(id)) return "explicitness";
  if (/^(emo_|humor_|psy_|hedge_|rel_|agency_)/.test(id)) return "emotion";
  return "measures";
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The unit of a characteristic's ranges, when it helps to read the group labels (" (per 1,000 words)"), and only when
 * the noun does not name it already: "story length in words", not "story length in words (words)"; "the number of
 * sentences", not "… (sentences)"; "title word count", not "… (words)".
 */
export function unitNote(variable) {
  const u = variable.unit || "";
  if (variable.bins.type !== "ranges" || !u || u.includes("(") || /^(share|yes|1 =|position|year$)/.test(u)) return "";
  const names = (word) => new RegExp(`(^|[^\\p{L}])${escapeRe(word)}([^\\p{L}]|$)`, "iu").test(variable.noun);
  if (names(u) || (!u.includes(" ") && u.endsWith("s") && names(u.slice(0, -1)))) return "";
  return ` (${u})`;
}

/**
 * What the rows of a chart are, and in what unit: "Stories grouped by story length in words" (above the rows). None
 * for a yes/no characteristic: its two rows name themselves ("Has dialogue", "No dialogue"), and its noun does not
 * read after "grouped by" ("has dialogue").
 */
export function groupedBy(variable) {
  if (variable.yes_subject) return "";
  return `Stories grouped by ${variable.noun}${unitNote(variable)}`;
}

/** One short paragraph on how to read the one-genre chart, the same for every characteristic. */
export function howToRead({ smallN }) {
  return (
    "Each row is a group of stories. The dot is the group’s median, printed beside it, and the bar is its " +
    "interquartile range. The dashed line is the median of all stories shown. Hatched bars with hollow dots hold " +
    `fewer than ${smallN} stories and deserve less trust.`
  );
}

function fmtYears(y) {
  const v = y >= 10 ? Math.round(y) : Math.round(y * 10) / 10;
  return v < 1 ? "under a year" : `${v} year${v === 1 ? "" : "s"}`;
}

/**
 * The line under the title: genre, which stories, and how many, as { lead, count } (the page links the count to
 * "Missing data and excluded stories", F55). `subtitle` gives the whole line as text.
 */
export function subtitleParts({ genre, subset, n, compare = false, genreCount = 0 }) {
  const parts = [compare ? `All ${genreCount} genres, side by side` : genre.name];
  if (subset && subset.id !== "all") parts.push(subset.label);
  return { lead: parts.join(" · "), count: n != null && !compare ? `${n.toLocaleString("en-US")} stories` : null };
}

export function subtitle(args) {
  const { lead, count } = subtitleParts(args);
  return count ? `${lead} · ${count}` : lead;
}

/** The story count in the kicker: "about 9,000" (to the nearest thousand), so it never reads as exact (F55). */
export function aboutCount(n) {
  return n >= 1000 ? `about ${(Math.round(n / 1000) * 1000).toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

const readsAsTrend = (variable) => variable.bins.ordered || Boolean(variable.yes_subject);

/**
 * The answer heading above a one-genre chart, from the existing pattern fields and group counts only:
 * a clear pattern gets the chart title ("Longer stories tend to …"); everything else a short, neutral answer.
 */
export function answerHeading({ variable, metric, genre, direction, effect, shown }) {
  if (shown != null && shown < 2) return "Too few stories to compare here";
  if (!readsAsTrend(variable)) return "Each group on its own";
  if (effect == null) return "Too few stories to judge a pattern";
  if (direction) return chartTitle({ variable, metric, genre, direction });
  return "No clear pattern";
}

/**
 * What screen readers hear when a chart has loaded (F47): the full chart title, then the answer when it says
 * something else ("How views vary with story length across all genres. No clear pattern.").
 */
export function announcement(title, answer) {
  if (!answer || answer === title) return title;
  return `${title}. ${/[.!?]$/.test(answer) ? answer : `${answer}.`}`;
}

const quoted = (label) => `“${label}”`;

/**
 * The takeaway line above the chart, as segments: plain strings and { strong } for the numbers.
 * "Median: 0.28 for “Under 2,000”, 0.89 for “7,000+”." Only for ordered and yes/no characteristics
 * with at least two groups shown; end groups that are hidden are named, never skipped silently.
 */
export function takeawaySegments({ variable, rows, valueText }) {
  if (!readsAsTrend(variable) || rows.length < 2) return null;
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  if (shown.length < 2) return null;
  const ends = [rows[0], rows[rows.length - 1]];
  const binary = Boolean(variable.yes_subject);
  const name = (r, i) => (binary ? lowerFirst(i === 0 ? variable.yes_subject : variable.no_subject) : quoted(r.label));
  const segs = ["Median: "];
  const visible = ends.map((r, i) => ({ r, i })).filter(({ r }) => r.stats && !r.stats.suppressed);
  const hidden = ends.filter((r) => !(r.stats && !r.stats.suppressed));
  visible.forEach(({ r, i }, j) => {
    if (j > 0) segs.push(", ");
    segs.push({ strong: valueText(r.stats.median) }, ` for ${name(r, i)}`);
  });
  if (hidden.length) {
    const names = hidden.map((r) => quoted(r.label));
    if (visible.length) segs.push("; ");
    segs.push(`${names.join(" and ")} ${hidden.length > 1 ? "have" : "has"} too few stories`);
  }
  segs.push(".");
  return segs;
}

export const segmentsText = (segs) =>
  (segs || []).map((s) => (typeof s === "string" ? s : s.strong ?? s.strength)).join("");

/** When only one group has enough stories: name it and its size. */
export function oneGroupNote(row) {
  return `Only ${quoted(row.label)} has enough stories in this selection (${row.stats.n.toLocaleString("en-US")}).`;
}

/** A one-sentence description of the chart for screen readers. */
export function chartSummary({ rows, valueText, n }) {
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  const count = n != null ? `; ${n.toLocaleString("en-US")} stories` : "";
  if (!shown.length) return `No group has enough stories to show${count}.`;
  if (shown.length === 1) {
    return `Median ${valueText(shown[0].stats.median)} for ${shown[0].label}; 1 group shown${count}.`;
  }
  const a = shown[0];
  const b = shown[shown.length - 1];
  return (
    `Median from ${valueText(a.stats.median)} for ${a.label} to ${valueText(b.stats.median)} for ` +
    `${b.label}; ${shown.length} groups${count}.`
  );
}

/**
 * The question sentence (concept B), in pieces so that each bracketed part can be a control:
 * "In [All genres], how do [favorites per 1,000 views] vary with [story length]?"
 * "does the" for singular measures ("how does the [average rating] vary"; the article stays outside the measure's
 * word); "vary with" for ordered characteristics, "vary by" for unordered ones and "differ between [first-person
 * stories and third-person stories]" for yes/no ones.
 */
export function questionParts({ variable, metric }) {
  const binary = Boolean(variable.yes_subject);
  return {
    aux: metric.plural ? "do" : "does",
    article: metric.plural ? "" : "the ",
    verb: binary ? "differ between" : variable.bins.ordered ? "vary with" : "vary by",
    measure: metric.noun,
    characteristic: binary ? `${lowerFirst(variable.yes_subject)} and ${variable.no_subject}` : variable.noun,
  };
}

/** The whole question as text (for tests and for screen readers' summary). */
export function questionText({ variable, metric, genre, compare = false }) {
  const p = questionParts({ variable, metric });
  const lead = compare ? "Genre by genre," : `In ${genre.name},`;
  return `${lead} how ${p.aux} ${p.article}${p.measure} ${p.verb} ${p.characteristic}?`;
}

// ------------------------------------------------------------------------------------------------ the Genres page
// (the sentences Explore and How it works use too; everything else is in genres.js, which loads with the page)

/**
 * The Genres page's question about one characteristic, in parts so that the characteristic can be a control: "How do
 * genres differ in [story length in words]?"; for yes/no characteristics "How common are [first-person stories] in
 * each genre?" (the genres, not the characteristic, are the subject: many nouns are plural).
 */
export function chartQuestion(variable) {
  if (variable.yes_subject) return { before: "How common are ", slot: lowerFirst(variable.yes_subject), after: " in each genre" };
  return { before: "How do genres differ in ", slot: variable.noun, after: "" };
}

export function chartQuestionText(variable) {
  const q = chartQuestion(variable);
  return `${q.before}${q.slot}${q.after}?`;
}

/** The question about one genre: "stories in {genre}", as genre names such as "Chain Stories" need. */
export const standsOutQuestion = (genre) => `What stands out about stories in ${genre.name}?`;

/** The median of the genres' story counts, to the nearest 10 ("each genre is a random sample of about 300 stories"). */
export function typicalSample(meta) {
  const ns = meta.genres
    .filter((g) => g.id !== "all")
    .map((g) => g.n)
    .sort((a, b) => a - b);
  if (!ns.length) return 0;
  const mid = ns.length % 2 ? ns[(ns.length - 1) / 2] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2;
  return Math.round(mid / 10) * 10;
}
