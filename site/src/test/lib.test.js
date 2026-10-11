import { describe, expect, it } from "vitest";
import { cellStats } from "../lib/data.js";
import {
  columnDecimals,
  formatCompact,
  formatDate,
  formatFixed,
  formatRange,
  formatValue,
  stepDecimals,
} from "../lib/format.js";
import { DEFAULT_STATE, defaultMetric, parseHash, sanitize, settledHash, toHash } from "../lib/urlState.js";
import { aboutCount, chartTitle, howToRead, patternNote, segmentsText, strengthWord, totalsNote } from "../lib/wording.js";
import { fixtureMeta, realMeta } from "./fixtures.js";

describe("formatting", () => {
  it("formats each kind of popularity measure", () => {
    expect(formatValue(22437, "count")).toBe("22,437");
    expect(formatValue(0.47, "rate")).toBe("0.47");
    expect(formatValue(0.0625, "rate")).toBe("0.063");
    expect(formatValue(12.34, "rate")).toBe("12.3");
    expect(formatValue(4.416, "rating")).toBe("4.42");
    expect(formatValue(0, "rate")).toBe("0");
    expect(formatValue(null, "rate")).toBe("–");
  });
});

describe("consistent number formats", () => {
  it("uses one number of decimals per column and axis", () => {
    expect(columnDecimals([1, 1.5, 0.66], "rate")).toBe(2);
    expect(columnDecimals([22437, 500], "count")).toBe(0);
    expect(columnDecimals([4.4], "rating")).toBe(2);
    expect(stepDecimals(0.25)).toBe(2);
    expect(stepDecimals(0.2)).toBe(1);
    expect(stepDecimals(5000)).toBe(0);
    expect(formatFixed(1, 1)).toBe("1.0");
    expect(formatFixed(22437, 0)).toBe("22,437");
    expect(formatRange(0.1, 0.66, 2)).toBe("0.10–0.66");
  });
  it("writes compact axis labels and US dates", () => {
    expect(formatCompact(60000)).toBe("60k");
    expect(formatCompact(800000)).toBe("800k");
    expect(formatCompact(12500)).toBe("12.5k");
    expect(formatCompact(1200000)).toBe("1.2M");
    expect(formatCompact(5000)).toBe("5,000");
    expect(formatDate("2026-10-01")).toBe("October 1, 2026");
  });
});

describe("reading the aggregates", () => {
  const cell = [120, 8.5, [0.5, 0.2, 0.9, 0.6], [4.4, 4.1, 4.7, 4.3, 110], null];
  it("unpacks a cell, with a measure-specific count when one is given", () => {
    expect(cellStats(cell, 0)).toEqual({ n: 120, median: 0.5, p25: 0.2, p75: 0.9, mean: 0.6 }); // the median age (8.5) is not read
    expect(cellStats(cell, 1).n).toBe(110);
    expect(cellStats(cell, 2)).toEqual({ n: 120, suppressed: true });
    expect(cellStats(null, 0)).toBeNull();
  });
});

describe("addresses", () => {
  it("round-trips the explorer settings through the address", () => {
    const state = { genre: "adult-romance", metric: "pop_views", v: "story_words", sub: "y2020" };
    expect(parseHash(toHash("explore", state))).toEqual({ page: "explore", state });
    expect(parseHash("#/methodology").page).toBe("methodology");
    expect(parseHash("#/methodology/tend-to")).toMatchObject({ page: "methodology", section: "tend-to" });
    expect(parseHash("#/patterns?genre=adult-romance&metric=pop_views")).toEqual({
      page: "patterns",
      state: { genre: "adult-romance", metric: "pop_views" },
    });
    expect(toHash("methodology", { section: "explicitness" })).toBe("#/methodology/explicitness");
    expect(toHash("patterns", { genre: "all", metric: "pop_views", v: "x" })).toBe("#/patterns?genre=all&metric=pop_views");
    expect(parseHash("").page).toBe("explore");
  });
  it("no longer reads or writes the similar-age check or the mode, and settles an old link without them", () => {
    expect(parseHash("#/explore?var=story_words&check=age").state).toEqual({ v: "story_words" });
    expect(parseHash("#/explore?mode=compare&genre=romance&var=story_words").state).toEqual({ genre: "romance", v: "story_words" });
    const s = sanitize({ v: "dlg_word_share", check: "age", mode: "compare" }, fixtureMeta);
    expect(toHash("explore", s)).not.toMatch(/check|mode|compare/);
    expect(toHash("explore", { ...s, check: "age", mode: "compare" })).not.toMatch(/check|mode|compare/);
    expect(settledHash("#/explore?var=dlg_word_share&check=age", "explore", s)).toBe(toHash("explore", s));
    expect(settledHash("#/explore?mode=compare&var=dlg_word_share", "explore", s)).toBe(toHash("explore", s));
    expect(settledHash(`#/explore?mode=one&${toHash("explore", s).split("?")[1]}`, "explore", s)).toBe(toHash("explore", s));
    // an address that leaves nothing out stays as it is, even one without settings
    expect(settledHash(toHash("explore", s), "explore", s)).toBeNull();
    expect(settledHash("#/explore", "explore", s)).toBeNull();
    expect(settledHash("#/explore?var=dlg_word_share", "explore", s)).toBeNull();
  });
  it("replaces anything the data does not know about", () => {
    const s = sanitize({ genre: "nope", metric: "nope", v: "nope", sub: "nope" }, fixtureMeta);
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_STATE).sort());
    expect(s.genre).toBe("all");
    // the test data has no average rating (too few stories have one), so its first measure stands in
    expect(fixtureMeta.default_metric).toBe("pop_rating");
    expect(s.metric).toBe(defaultMetric(fixtureMeta));
    expect(s.metric).toBe(fixtureMeta.metrics[0].id);
    expect(fixtureMeta.variables.map((v) => v.id)).toContain(s.v);
    expect(s.sub).toBe("all");
  });
});

const CAUSAL = /\b(cause[sd]?|causing|drives?|driven|driving|makes? readers|leads? to|because|results? in|boosts?|increases?)\b/i;

function everyTitle(meta) {
  const titles = [];
  const genres = [meta.genres[0], meta.genres[meta.genres.length - 1]];
  for (const variable of meta.variables) {
    for (const metric of meta.metrics) {
      for (const genre of genres) {
        for (const direction of [-1, 0, 1]) titles.push(chartTitle({ variable, metric, genre, direction }));
      }
    }
  }
  return titles;
}

describe("chart titles", () => {
  const meta = fixtureMeta;
  const v = (id) => meta.variables.find((x) => x.id === id);
  const m = (id) => meta.metrics.find((x) => x.id === id);
  const all = meta.genres[0];
  const romance = meta.genres.find((g) => g.id === "romance");

  it("states a pattern only when told it is clear", () => {
    const fav = m("pop_fav_per_1k_views");
    expect(chartTitle({ variable: v("dlg_word_share"), metric: fav, genre: all, direction: 1 })).toBe(
      "Stories with more dialogue tend to get more favorites per 1,000 views",
    );
    expect(chartTitle({ variable: v("dlg_word_share"), metric: fav, genre: romance, direction: -1 })).toBe(
      "In Romance, stories with more dialogue tend to get fewer favorites per 1,000 views",
    );
    expect(chartTitle({ variable: v("dlg_word_share"), metric: fav, genre: romance, direction: 0 })).toBe(
      "How favorites per 1,000 views vary with dialogue share in Romance",
    );
  });

  it("words two-group and category characteristics", () => {
    const views = m("pop_views");
    expect(chartTitle({ variable: v("dlg_has_dialogue"), metric: views, genre: all, direction: 1 })).toBe(
      "Stories with dialogue tend to receive more views than stories without dialogue",
    );
    expect(chartTitle({ variable: v("dlg_has_dialogue"), metric: views, genre: all, direction: 0 })).toBe(
      "How views vary between stories with dialogue and stories without dialogue across all genres",
    );
    expect(chartTitle({ variable: v("pov_class"), metric: views, genre: all, direction: 1 })).toBe(
      "How views vary by narrative perspective across all genres",
    );
  });

  it("never uses causal language and never leaves a gap, for every characteristic and measure", () => {
    for (const meta2 of [fixtureMeta, realMeta()].filter(Boolean)) {
      for (const t of everyTitle(meta2)) {
        expect(t).not.toMatch(CAUSAL);
        expect(t).not.toMatch(/undefined|null|NaN| {2}/);
        expect(t[0]).toBe(t[0].toUpperCase());
      }
    }
  });

  it("describes how clear a pattern is, in one short sentence (F40)", () => {
    expect(strengthWord(0.12)).toBe("weak");
    expect(strengthWord(-0.3)).toBe("moderate");
    expect(strengthWord(0.55)).toBe("strong");
    const text = (args) => segmentsText(patternNote(args));
    const clear = patternNote({ variable: v("dlg_word_share"), direction: 1, effect: 0.3 });
    expect(segmentsText(clear)).toBe("A moderate pattern; individual stories vary a lot within every group.");
    expect(clear).toContainEqual({ strength: "moderate" }); // the page links the strength word to its definition
    expect(text({ variable: v("dlg_has_dialogue"), direction: -1, effect: -0.5 })).toBe(
      "A strong pattern; individual stories vary a lot within every group.",
    );
    expect(text({ variable: v("dlg_word_share"), direction: 0, effect: 0.05 })).toBe(
      "The groups differ only a little, or not consistently.",
    );
    expect(text({ variable: v("dlg_word_share"), direction: 0, effect: null, smallN: 30 })).toBe(
      "A pattern is judged only when the groups at both ends have at least 30 stories.",
    );
    // no note for groups without an order: the heading says it ("Each group on its own"); How to read is the same
    // paragraph for every characteristic (the owner's follow-up: no sentence on not summing them up as one trend)
    expect(patternNote({ variable: v("pov_class"), direction: 0, effect: null })).toBeNull();
    expect(howToRead({ smallN: 30 })).toBe(
      "Each row is a group of stories. The dot is the group’s median, printed beside it, and the bar is its " +
        "interquartile range. The dashed line is the median of all stories shown. Hatched bars with hollow dots hold " +
        "fewer than 30 stories and deserve less trust.",
    );
    expect(text({ variable: v("dlg_word_share"), direction: 0, effect: 0.1, shown: 1 })).toMatch(/nothing to compare/);
  });

  it("rounds the story count in the kicker (F55)", () => {
    expect(aboutCount(8996)).toBe("about 9,000");
    expect(aboutCount(9499)).toBe("about 9,000");
    expect(aboutCount(278)).toBe("278");
  });

  it("warns about story age for totals only", () => {
    expect(totalsNote(m("pop_views"))).toEqual({
      lead: "Totals grow with time online.",
      text: "Older stories have had longer to collect views.",
    });
    expect(totalsNote(m("pop_fav_per_1k_views"))).toBeNull();
  });
});

describe("reduced motion", () => {
  it("scrolls without animation when the visitor asks for reduced motion", async () => {
    const { scrollBehavior, prefersReducedMotion } = await import("../lib/motion.js");
    const original = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q.includes("reduce"), media: q });
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe("auto");
    window.matchMedia = () => ({ matches: false });
    expect(scrollBehavior()).toBe("smooth");
    window.matchMedia = original;
  });
});
