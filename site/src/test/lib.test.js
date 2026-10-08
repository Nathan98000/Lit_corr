import { describe, expect, it } from "vitest";
import { cellStats, endGroups, groupRows, relativeMedian } from "../lib/data.js";
import { formatAge, formatRatio, formatValue } from "../lib/format.js";
import { DEFAULT_STATE, parseHash, sanitize, toHash } from "../lib/urlState.js";
import { ageNotes, chartTitle, patternNote, strengthWord } from "../lib/wording.js";
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
    expect(formatRatio(1.26)).toBe("1.3×");
    expect(formatAge(0.4)).toBe("under a year");
    expect(formatAge(1)).toBe("1 year");
    expect(formatAge(12.2)).toBe("12 years");
  });
});

describe("reading the aggregates", () => {
  const cell = [120, 8.5, [0.5, 0.2, 0.9, 0.6], [4.4, 4.1, 4.7, 4.3, 110], null];
  it("unpacks a cell, with a measure-specific count when one is given", () => {
    expect(cellStats(cell, 0)).toEqual({ n: 120, age: 8.5, median: 0.5, p25: 0.2, p75: 0.9, mean: 0.6 });
    expect(cellStats(cell, 1).n).toBe(110);
    expect(cellStats(cell, 2)).toEqual({ n: 120, age: 8.5, suppressed: true });
    expect(cellStats(null, 0)).toBeNull();
  });
  it("compares a group with all stories shown", () => {
    expect(relativeMedian({ median: 0.6 }, { median: 0.4 })).toBeCloseTo(1.5);
    expect(relativeMedian({ suppressed: true }, { median: 0.4 })).toBeNull();
    expect(relativeMedian({ median: 1 }, { median: 0 })).toBeNull();
  });
  it("finds the end groups that are shown", () => {
    const variable = { bins: { labels: ["a", "b", "c"] } };
    const rows = groupRows(variable, { b: [null, [50, 3, [1, 1, 1, 1]], [60, 9, [2, 2, 2, 2]]] }, 0);
    expect(endGroups(rows).map((r) => r.label)).toEqual(["b", "c"]);
  });
});

describe("addresses", () => {
  it("round-trips the explorer settings through the address", () => {
    const state = { mode: "compare", genre: "adult-romance", metric: "pop_views", v: "story_words", sub: "y2020" };
    expect(parseHash(toHash("explore", state))).toEqual({ page: "explore", state });
    expect(parseHash("#/methodology").page).toBe("methodology");
    expect(parseHash("").page).toBe("explore");
  });
  it("replaces anything the data does not know about", () => {
    const s = sanitize({ mode: "weird", genre: "nope", metric: "nope", v: "nope", sub: "nope" }, fixtureMeta);
    expect(s.mode).toBe(DEFAULT_STATE.mode);
    expect(s.genre).toBe("all");
    expect(s.metric).toBe(fixtureMeta.default_metric);
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
      titles.push(chartTitle({ variable, metric, genre: genres[0], direction: 0, compare: true }));
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

  it("describes how clear a pattern is", () => {
    expect(strengthWord(0.12)).toBe("weak");
    expect(strengthWord(-0.3)).toBe("moderate");
    expect(strengthWord(0.55)).toBe("strong");
    expect(patternNote({ variable: v("dlg_word_share"), direction: 1, effect: 0.3 })).toMatch(/moderate pattern/);
    expect(patternNote({ variable: v("dlg_word_share"), direction: 0, effect: 0.05 })).toMatch(/^No clear pattern/);
    expect(patternNote({ variable: v("pov_class"), direction: 0, effect: null })).toMatch(/does not sum them up/);
    expect(patternNote({ variable: v("dlg_word_share"), direction: 0, effect: 0.1, shown: 1 })).toMatch(/nothing to compare/);
  });

  it("warns about story age for totals and when groups differ in age", () => {
    const views = m("pop_views");
    expect(ageNotes({ metric: views, ends: null })[0]).toMatch(/Totals grow with time online/);
    const ends = [
      { label: "Low", stats: { age: 12 } },
      { label: "High", stats: { age: 4 } },
    ];
    const notes = ageNotes({ metric: m("pop_fav_per_1k_views"), ends });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/“Low” has been online 12 years, in “High” 4 years/);
    expect(ageNotes({ metric: m("pop_fav_per_1k_views"), ends: [ends[0], { label: "x", stats: { age: 11 } }] })).toEqual([]);
  });
});
