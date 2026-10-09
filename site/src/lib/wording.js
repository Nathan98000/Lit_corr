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
    if (binary) return `How ${metric.noun} ${verb} between ${lowerFirst(variable.yes_subject)} and ${variable.no_subject}, genre by genre`;
    return `How ${metric.noun} ${verb} ${variable.bins.ordered ? "with" : "by"} ${variable.noun}, genre by genre`;
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
    return `How ${metric.noun} ${verb} between ${lowerFirst(variable.yes_subject)} and ${variable.no_subject}${where(genre)}`;
  }
  if (!variable.bins.ordered) return `How ${metric.noun} ${verb} by ${variable.noun}${where(genre)}`;
  return `How ${metric.noun} ${verb} with ${variable.noun}${where(genre)}`;
}

/** One or two sentences on how clear the pattern is. `shown` is the number of groups with enough stories. */
export function patternNote({ variable, direction, effect, compare = false, shown = null }) {
  if (!compare && shown != null && shown < 2) {
    return "Only one group has enough stories for this selection, so there is nothing to compare. Try “All stories” or All genres.";
  }
  if (!variable.bins.ordered && !variable.yes_subject) {
    return "Each group is shown on its own; this view does not sum them up as one trend.";
  }
  if (compare) {
    return "Arrows mark the genres where the pattern is clear enough to describe; a dash means no clear pattern.";
  }
  if (effect == null) return "There are too few stories here to judge whether there is a pattern.";
  if (direction) {
    return `This is a ${strengthWord(effect)} pattern: the typical story differs between the groups, but ` +
      "individual stories vary a lot within every group.";
  }
  return "No clear pattern: the groups differ only a little, or not consistently enough to sum up in a sentence.";
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
            `The groups also differ in age: the typical story in “${ends[0].label}” has been online ` +
            `${fmtYears(a)}, in “${ends[1].label}” ${fmtYears(b)}. Age goes with popularity too, so it can ` +
            "shape this chart.",
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

/** One short paragraph on how to read the one-genre chart. */
export function howToRead({ smallN }) {
  return (
    "Each row is a group of stories. The dot is the typical story (the median: half the stories score higher, " +
    "half lower) and its value is printed beside it; the bar spans the middle half of stories. The dashed line " +
    `is the typical story among all stories shown. Hatched bars with hollow dots hold fewer than ${smallN} ` +
    "stories and deserve less trust."
  );
}

function fmtYears(y) {
  const v = y >= 10 ? Math.round(y) : Math.round(y * 10) / 10;
  return v < 1 ? "under a year" : `${v} year${v === 1 ? "" : "s"}`;
}

/** The line under the title: genre, which stories, and how many. */
export function subtitle({ genre, subset, n, compare = false, genreCount = 0 }) {
  const parts = [compare ? `All ${genreCount} genres, side by side` : genre.name];
  if (subset && subset.id !== "all") parts.push(subset.label);
  if (n != null && !compare) parts.push(`${n.toLocaleString("en-US")} stories`);
  return parts.join(" · ");
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
 * "Typical story: 0.28 for “Under 2,000”, 0.89 for “7,000+”." Only for ordered and yes/no characteristics
 * with at least two groups shown; end groups that are hidden are named, never skipped silently.
 */
export function takeawaySegments({ variable, rows, valueText }) {
  if (!readsAsTrend(variable) || rows.length < 2) return null;
  const shown = rows.filter((r) => r.stats && !r.stats.suppressed);
  if (shown.length < 2) return null;
  const ends = [rows[0], rows[rows.length - 1]];
  const binary = Boolean(variable.yes_subject);
  const name = (r, i) => (binary ? lowerFirst(i === 0 ? variable.yes_subject : variable.no_subject) : quoted(r.label));
  const segs = ["Typical story: "];
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

export const segmentsText = (segs) => (segs || []).map((s) => (typeof s === "string" ? s : s.strong)).join("");

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
    return `Typical story ${valueText(shown[0].stats.median)} for ${shown[0].label}; 1 group shown${count}.`;
  }
  const a = shown[0];
  const b = shown[shown.length - 1];
  return (
    `Typical story from ${valueText(a.stats.median)} for ${a.label} to ${valueText(b.stats.median)} for ` +
    `${b.label}; ${shown.length} groups${count}.`
  );
}

/**
 * The question sentence (concept B), in pieces so that each bracketed part can be a control:
 * "In [All genres], how do [favorites per 1,000 views] vary with [story length]?"
 * "does" for singular measures; "vary with" for ordered characteristics, "vary by" for unordered ones and
 * "differ between [first-person stories and third-person stories]" for yes/no ones.
 */
export function questionParts({ variable, metric }) {
  const binary = Boolean(variable.yes_subject);
  return {
    aux: metric.plural ? "do" : "does",
    verb: binary ? "differ between" : variable.bins.ordered ? "vary with" : "vary by",
    measure: metric.noun,
    characteristic: binary ? `${lowerFirst(variable.yes_subject)} and ${variable.no_subject}` : variable.noun,
  };
}

/** The whole question as text (for tests and for screen readers' summary). */
export function questionText({ variable, metric, genre, compare = false }) {
  const p = questionParts({ variable, metric });
  const lead = compare ? "Genre by genre," : `In ${genre.name},`;
  return `${lead} how ${p.aux} ${p.measure} ${p.verb} ${p.characteristic}?`;
}
