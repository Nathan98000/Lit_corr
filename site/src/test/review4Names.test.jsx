// Design review 4, phase 3 (O9, O15, L1): the names and small fixes on Explore and everywhere. "all genres" in lower
// case inside the questions, "Download image" on every image button, the rating axis's scale, the stories in words on
// phones, and no value under the dashed line of all stories.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { cellStats, clearCache, groupRows } from "../lib/data.js";
import { outside, overlaps, rangeLayout, REF_GAP, valuesOnRef } from "../lib/rangeLayout.js";
import { SCALE_WORDS, genreWords, measureAxisTitle, questionText } from "../lib/wording.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const readReal = (id, sub = "all") => JSON.parse(readFileSync(path.join(REAL, "v", id, `${sub}.json`), "utf8"));

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector("main [aria-busy='true']")).toBeNull());
}

/** A sentence's words as shown: without the hidden labels and the selects' options. */
function shown(el) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll(".visually-hidden, select").forEach((x) => x.remove());
  return copy.textContent.replace(/⁠/g, "");
}

describe("O9: “all genres” in lower case inside the questions", () => {
  it("reads so on Explore and Patterns, while the genre lists keep their option “All genres”", async () => {
    expect(genreWords(fixtureMeta.genres[0])).toBe("all genres");
    expect(genreWords(fixtureMeta.genres[1])).toBe(fixtureMeta.genres[1].name);
    const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
    const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
    expect(questionText({ variable, metric, genre: fixtureMeta.genres[0] })).toBe(
      "In all genres, how do favorites per 1,000 views vary with dialogue share?",
    );
    await open("#/explore?var=dlg_word_share&metric=pop_fav_per_1k_views");
    expect(shown(document.querySelector(".sentence"))).toBe("In all genres, how do favorites per 1,000 views vary with dialogue share?");
    expect(screen.getByRole("combobox", { name: "Genre" }).options[0].textContent).toBe("All genres");
    cleanup();
    await open("#/patterns?genre=all&metric=pop_fav_per_1k_views");
    await waitFor(() => expect(document.querySelector(".pattern-count")).toBeTruthy());
    expect(shown(document.querySelector(".patterns-question"))).toBe("Clear patterns in all genres with favorites per 1,000 views");
    expect(screen.getByRole("combobox", { name: "Genre" }).options[0].textContent).toBe("All genres");
    expect(document.body.textContent).not.toMatch(/In All genres/);
  });

  it.skipIf(!real)("never shows “In All genres” on the real data's default question", () => {
    const words = real.variables.find((v) => v.id === "story_words");
    const rating = real.metrics.find((m) => m.id === "pop_rating");
    expect(questionText({ variable: words, metric: rating, genre: real.genres[0] })).toBe(
      "In all genres, how does the average rating vary with word count?",
    );
    // the placeholder the first screen shows until the data arrives is the same question
    expect(readFileSync(path.join(here, "..", "App.jsx"), "utf8")).toMatch(
      /const DEFAULT_QUESTION = "In all genres, how does the average rating vary with word count\?";/,
    );
  });
});

describe("O15: “Download image”", () => {
  it("is every image button's words, its name starting with them, on every page that has one", async () => {
    const names = [];
    for (const hash of ["#/explore", "#/genres?var=dlg_word_share", "#/trends?var=dlg_word_share"]) {
      await open(hash);
      const buttons = screen.getAllByRole("button", { name: /^Download image/ });
      for (const b of buttons) {
        expect(b.textContent).toBe("Download image");
        names.push(b.getAttribute("aria-label"));
      }
      expect(document.body.textContent).not.toMatch(/Download PNG/);
      cleanup();
    }
    expect([...new Set(names)]).toEqual(["Download image of this chart"]);
  });
});

describe("L1: Explore's rating axis and its rows on phones", () => {
  it("titles the average rating's axis with its scale, from wording.js's words for the format", () => {
    expect(SCALE_WORDS).toEqual({ rating: "1 to 5 stars" });
    expect(measureAxisTitle({ label: "Average rating", format: "rating" })).toBe("Average rating (1 to 5 stars)");
    expect(measureAxisTitle({ label: "Views", format: "count" })).toBe("Views");
    for (const words of Object.values(SCALE_WORDS)) {
      expect(words).not.toMatch(UK_SPELLINGS);
      expect(words).not.toMatch(CAUSAL);
    }
  });

  it("says each group's stories in words on phones, as wider screens do (“2,631 stories”, never “n = 2,631”)", () => {
    const stats = (n) => ({ n, median: 4.3, p25: 4.1, p75: 4.6, mean: 4.3 });
    const rows = [2631, 12, 40].map((n, index) => ({ index, label: `Group number ${index + 1}`, stats: stats(n) }));
    for (const width of [288, 343, 720]) {
      const layout = rangeLayout({ rows, overall: stats(2683), format: "rating", width, smallN: 30, minN: 10 });
      expect(layout.rows.map((r) => r.nText)).toEqual(["2,631 stories", "12 stories*", "40 stories"]);
    }
    const months = ["Jan", "Feb"].map((label, index) => ({ index, label, stats: index ? null : stats(2631) }));
    const inline = rangeLayout({ rows: months, overall: stats(2631), format: "rating", width: 288, smallN: 30, minN: 10 });
    expect(inline.mode).toBe("inline");
    expect(inline.rows.map((r) => r.nText)).toEqual(["2,631 stories", "fewer than 10"]);
  });

  it.skipIf(!real)("never puts a printed value under the dashed line, and never overlaps, for every chart on phones", () => {
    const problems = [];
    let moved = 0;
    for (const variable of real.variables) {
      const data = readReal(variable.id);
      for (const g of ["all", "adult-romance", "adult-how-to", "taboo-sex-stories", "chain-stories"]) {
        real.metrics.forEach((metric, k) => {
          const gd = data.g[g];
          const rows = groupRows(variable, gd, k);
          const overall = cellStats(gd?.o, k);
          for (const width of [288, 343]) {
            const layout = rangeLayout({ rows, overall, format: metric.format, width, smallN: real.small_n, minN: real.min_n });
            if (valuesOnRef(layout).length || overlaps(layout).length || outside(layout).length) problems.push(`${variable.id} ${g} ${metric.id} @${width}`);
            moved += layout.rows.filter((r) => r.value && Math.abs(r.value.x - (layout.ref?.x ?? -99) - REF_GAP) < 1e-9).length;
          }
        });
      }
    }
    expect(problems).toEqual([]);
    expect(moved).toBeGreaterThan(0); // the line would have run through some of them
  });
});
