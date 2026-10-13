// Design review 4, phase 1 (STAGE2_DESIGN_IMPLEMENTATION_4_PROMPT.md): the data's words and format. O8, the
// reading-list measure's verbs read after "tend to"; O9, one name per idea (word count, story age); O18, no median
// age in the files.
import { cleanup, render, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { cellStats, clearCache, decodePattern } from "../lib/data.js";
import { chartTitle } from "../lib/wording.js";
import { fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, "..", "..", "public", "aggregates");
const SRC = path.join(here, "..");
const real = realMeta();
const realJson = (rel) => JSON.parse(readFileSync(path.join(REAL, rel), "utf8"));
const realFetch = async (url) => {
  const body = readFileSync(path.join(REAL, String(url).split("aggregates/")[1]), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const metas = [fixtureMeta, real].filter(Boolean);

// a verb that can't follow "tend to" (F97: "Longer stories tend to are added to more reading lists")
const NOT_AFTER_TEND_TO = new Set(["are", "is", "has", "were", "was", "does", "gets", "receives", "collects"]);

describe("O8: every measure's “more” and “less” read after “tend to”", () => {
  it("start with a base verb, in the test data and the real data", () => {
    for (const meta of metas) {
      for (const m of meta.metrics) {
        for (const key of ["more", "less"]) {
          const first = m[key].split(" ")[0];
          expect(NOT_AFTER_TEND_TO.has(first) || (/s$/.test(first) && !/ss$/.test(first)), `${m.id} ${key}`).toBe(false);
        }
      }
    }
  });

  it.skipIf(!real)("word the reading-list titles as the copy does, and none says “tend to are”", () => {
    const k = real.metrics.findIndex((m) => m.id === "pop_reading_lists_per_1k_views");
    const metric = real.metrics[k];
    const words = real.variables.find((v) => v.id === "story_words");
    const all = real.genres[0];
    expect(chartTitle({ variable: words, metric, genre: all, direction: 1 })).toBe(
      "Longer stories tend to get added to more reading lists per 1,000 views",
    );
    // every clear reading-list pattern in patterns.json (all stories, every genre), titled as the page titles it
    const patterns = realJson("patterns.json");
    let titles = 0;
    for (const genre of real.genres) {
      const codes = patterns.g[genre.id][k];
      real.variables.forEach((variable, i) => {
        const p = decodePattern(patterns.key, codes[i]);
        if (!p?.direction) return;
        const title = chartTitle({ variable, metric, genre, direction: p.direction });
        titles += 1;
        expect(title).not.toMatch(/tend to (are|is|has|were)\b/);
        expect(title).toMatch(/tend to get added to (more|fewer) reading lists per 1,000 views/);
      });
    }
    expect(titles).toBe(1418); // the titles that read "tend to are added to" in the review (F97): 1,146 then, 1,418 since the data update 20261013
  });
});

/** The site's own visible text: its sources without comments, as siteText.test.js reads them. */
function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === "test" ? [] : sources(p);
    return /\.(jsx?|css)$/.test(name) ? [p] : [];
  });
}
const visible = (file) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("O9: one name for each idea", () => {
  beforeEach(() => {
    clearCache();
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("never says “story length in words” in the site's own text or in the data", () => {
    for (const f of sources(SRC)) expect(visible(f), path.relative(SRC, f)).not.toMatch(/story length in words/i);
    for (const meta of metas) expect(JSON.stringify(meta)).not.toMatch(/story length in words/i);
  });

  it.skipIf(!real)("calls word count “Word count” and “word count”, and story age “Story age (years online)”", () => {
    const v = Object.fromEntries(real.variables.map((x) => [x.id, x]));
    expect([v.story_words.label, v.story_words.noun, Boolean(v.story_words.plural)]).toEqual(["Word count", "word count", false]);
    expect([v.age_years.label, v.age_years.noun]).toEqual(["Story age (years online)", "story age"]);
  });

  for (const hash of [
    "#/explore",
    "#/genres",
    "#/genres?view=genre&genre=adult-romance",
    "#/trends?var=story_words",
    "#/trends",
    "#/methodology/glossary",
  ]) {
    it.skipIf(!real)(`shows no “story length in words” on ${hash} (the real data)`, { timeout: 30000 }, async () => {
      vi.stubGlobal("fetch", realFetch);
      window.history.replaceState(null, "", `/${hash}`);
      render(<App />);
      await waitFor(() => expect(document.querySelector("main [aria-busy='true']")).toBeNull(), { timeout: 20000 });
      await waitFor(() => expect(document.querySelector("main h1, main h2")).toBeTruthy());
      expect(document.body.textContent).not.toMatch(/story length in words/i);
      // the question names word count where it is asked about (its words as shown, without the hidden labels)
      const shown = () => {
        const copy = document.querySelector(".sentence").cloneNode(true);
        copy.querySelectorAll(".visually-hidden, select").forEach((el) => el.remove());
        return copy.textContent;
      };
      if (hash === "#/explore") expect(shown()).toMatch(/vary with word count/);
      if (hash === "#/genres") expect(shown()).toMatch(/differ in word count/);
    });
  }
});

describe("O18: the files carry no median age", () => {
  it("v/ cells are [n, m0, m1, …], one entry per measure, in the test data", () => {
    const n = fixtureMeta.metrics.length;
    for (const variable of fixtureMeta.variables) {
      const file = fixtureFile(`v/${variable.id}/all.json`);
      for (const g of Object.values(file.g)) {
        for (const cell of [...g.b, g.o]) if (cell) expect(cell.length).toBe(1 + n);
      }
    }
    expect(fixtureFile("genres/all.json")).not.toHaveProperty("age");
  });

  it.skipIf(!real)("v/ cells and the genres files hold no median age in the real data", () => {
    const n = real.metrics.length;
    const file = realJson("v/story_words/all.json");
    for (const g of Object.values(file.g)) {
      for (const cell of [...g.b, g.o]) if (cell) expect(cell.length).toBe(1 + n);
    }
    // the first group's average rating, read at its new place
    const k = real.metrics.findIndex((m) => m.id === "pop_rating");
    const s = cellStats(file.g.all.b[0], k);
    expect(s.median).toBeGreaterThanOrEqual(1);
    expect(s.median).toBeLessThanOrEqual(5);
    for (const name of readdirSync(path.join(REAL, "genres"))) expect(realJson(`genres/${name}`)).not.toHaveProperty("age");
  });
});
