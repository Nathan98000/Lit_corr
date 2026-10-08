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

/** Notes about story age: totals grow with time online, and groups can differ in age. */
export function ageNotes({ metric, ends }) {
  const notes = [];
  if (metric.age) {
    notes.push(`Totals grow with time online, so older stories have had longer to collect ${metric.noun}. ` +
      "Views per month and the per-1,000-views measures make old and new stories easier to compare.");
  }
  if (ends) {
    const [a, b] = ends.map((r) => r.stats.age);
    if (a != null && b != null) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi - lo >= 2 && hi >= 1.4 * Math.max(lo, 0.5)) {
        notes.push(`The groups also differ in age: the typical story in “${ends[0].label}” has been online ` +
          `${fmtYears(a)}, in “${ends[1].label}” ${fmtYears(b)}. Age goes with popularity too, so it can ` +
          "shape this chart. To compare stories of similar age, use a “Published …” option under Stories included.");
      }
    }
  }
  return notes;
}

function fmtYears(y) {
  const v = y >= 10 ? Math.round(y) : Math.round(y * 10) / 10;
  return v < 1 ? "under a year" : `${v} year${v === 1 ? "" : "s"}`;
}

export const ASSOCIATION_NOTE =
  "Patterns describe stories on Literotica. They do not show that a characteristic changes how popular a " +
  "story is: the groups can differ in other ways as well.";

/** The line under the title: genre, which stories, and how many. */
export function subtitle({ genre, subset, n, compare = false, genreCount = 0 }) {
  const parts = [compare ? `All ${genreCount} genres, side by side` : genre.name];
  if (subset && subset.id !== "all") parts.push(subset.label);
  if (n != null && !compare) parts.push(`${n.toLocaleString("en-US")} stories`);
  return parts.join(" · ");
}
