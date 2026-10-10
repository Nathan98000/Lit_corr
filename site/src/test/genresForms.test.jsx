// The Genres page's other forms (View 1): 100% bars for named groups (grp) and ordered bands (band), and the split
// chart of mostly-zero characteristics (zero, D6); their tables, colors and geometry.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { splitRows } from "../components/GenreSplit.jsx";
import { mixRows } from "../components/GenreMix.jsx";
import { clearCache } from "../lib/data.js";
import { SPLIT_SIDE, bandColors, inkOn, layoutProblems, mixColors, mixLayout, splitLayout } from "../lib/genreLayout.js";
import { allGenresLine, bandQuartiles, chartDomain, comparison, formatNumber, genreRows, rowDetails, takeawayLists, tickFormatFor } from "../lib/genres.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));
const text = (segs) => segs.map((s) => (typeof s === "string" ? s : s.strong)).join("");

// an ordered band characteristic, which the test data does not have
const BAND = {
  id: "author_stories_count",
  label: "Author’s story count",
  topic: "narration",
  subgroup: "Narration",
  kind: "count",
  unit: "stories",
  description: "Stories by the author.",
  caveat: "",
  bins: { type: "levels", labels: ["1 story", "2–5", "6–20", "21–50"], ordered: true },
  noun: "the author’s number of stories",
  n: 278,
  more: "Stories by more prolific authors",
};
const meta = {
  ...fixtureMeta,
  variables: [...fixtureMeta.variables, BAND],
  topics: fixtureMeta.topics.map((t) => (t.id === "narration" ? { ...t, ids: [...t.ids, BAND.id] } : t)),
};

/** The test data, with the band characteristic and differences put in on purpose. */
function formsFetch() {
  const serve = fixtureFetch();
  const fn = async (url) => {
    if (String(url).endsWith("meta.json")) return { ok: true, status: 200, json: async () => meta };
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = await res.json();
    body.c.author_stories_count = {
      k: "band",
      q: [[278, 0.3, 0.3, 0.2, 0.2], [150, 0.4, 0.3, 0.2, 0.1], [120, 0.1, 0.2, 0.3, 0.4], null],
      r: [null, -0.15, 0.41, null],
      f: [0, 0, 1, 0],
    };
    body.c.pov_class.r = [null, 0.04, 0.27, null];
    body.c.pov_class.f = [0, 0, 1, 0];
    body.c.emo_anger_per_1k.r = [null, -0.05, 0.24, null];
    body.c.emo_anger_per_1k.f = [0, 0, 1, 0];
    return { ok: true, status: 200, json: async () => body };
  };
  fn.calls = serve.calls;
  return fn;
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", formsFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openGenres(hash, width = null) {
  if (width) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
  }
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
}

const columns = () => within(screen.getByRole("table", { hidden: true })).getAllByRole("columnheader", { hidden: true }).map((h) => h.textContent);

describe("named groups: 100% bars", () => {
  it("draw a bar per genre, the ≠ mark in its own column, and name every share", async () => {
    await openGenres("#/genres?var=pov_class");
    const chart = document.querySelector(".genre-mix.kind-grp");
    expect(chart).toBeTruthy();
    expect(document.querySelector(".genres-page .chart-title").textContent).toBe("1 of 2 genres clearly differs from all genres");
    expect(document.querySelector(".genre-list").textContent).toBe("≠ A different mix: Romance.");
    expect(document.querySelector(".all-line").textContent).toMatch(/^All genres: First person \(I\) \d+%, .* Mixed \d+%\.$/);
    const rows = [...chart.querySelectorAll(".row")];
    expect(rows.map((r) => r.getAttribute("aria-label").split(":")[0])).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    expect(rows[2].getAttribute("aria-label")).toMatch(/^Romance: First person \(I\) \d+%, .*, 120 stories, median age [\d.]+ years, a clearly different mix from all genres$/);
    expect(rows[2].querySelector(".gmark").textContent).toBe("≠");
    expect(rows[1].querySelector(".gmark")).toBeNull();
    // the mark's column sits between the name and the bar
    const markX = Number(rows[2].querySelector(".gmark").getAttribute("x"));
    const labelX = Number(rows[2].querySelector(".glabel").getAttribute("x"));
    const barX = Number(rows[2].querySelector(".segment").getAttribute("x"));
    expect(labelX).toBeLessThan(markX);
    expect(markX).toBeLessThan(barX);
    // the legend: the groups' swatches and what ≠ means, with the link to how it is decided
    const legend = document.querySelector(".genre-legend");
    expect([...legend.querySelectorAll("li")].map((li) => li.textContent.trim())).toEqual([
      "First person (I)",
      "First person plural (we)",
      "Second person (you)",
      "Third person",
      "Mixed",
      "≠ A clearly different mix (how this is decided)",
    ]);
    expect(within(legend).getByRole("link", { name: "how this is decided" }).getAttribute("href")).toBe("#/methodology/genres");
    expect(columns()).toEqual(["Genre", "Stories", "First person (I)", "First person plural (we)", "Second person (you)", "Third person", "Mixed", "Median age", "Compared with all genres"]);
  });

  it("give the darkest color to the group that is largest across all genres", () => {
    const c = mixColors("grp", [0.1, 0.55, 0.3, 0.05]);
    expect(c[1].fill).toBe("#2b63c6");
    expect(c[1].ink).toBe("#fff");
    expect(new Set(c.map((x) => x.fill)).size).toBe(4);
  });
});

describe("ordered bands: 100% bars from light to dark", () => {
  it("mark a genre higher or lower with ▲ ▼, and say the median band", async () => {
    await openGenres("#/genres?var=author_stories_count");
    expect(document.querySelector(".genre-mix.kind-band")).toBeTruthy();
    expect(document.querySelector(".genre-list").textContent).toBe("▲ Higher: Romance.");
    expect(document.querySelector(".all-line").textContent).toBe(
      "All genres: median 2–5, interquartile range 1 story to 6–20. Genre medians run from 2–5 to 6–20.",
    );
    const romance = [...document.querySelectorAll(".genre-mix .row")][2];
    expect(romance.querySelector(".gmark").textContent).toBe("▲");
    expect(romance.getAttribute("aria-label")).toBe(
      "Romance: median 6–20, 1 story 10%, 2–5 20%, 6–20 30%, 21–50 40%, 120 stories, median age 11.5 years, clearly higher than all genres",
    );
    expect(screen.queryByRole("radiogroup", { name: "Order" })).toBeNull(); // bands are not put in order
    // the legend keeps the general words, whatever the band's own words (Later / Earlier for the peak positions)
    expect(document.querySelector(".genre-legend").textContent).toMatch(/▲▼ Clearly higher or lower than all genres/);
  });

  it("go from light to dark, with text that reaches 4.5:1 on every color", () => {
    for (const n of [2, 5, 7]) {
      const fills = bandColors(n);
      expect(fills).toHaveLength(n);
      const lum = fills.map((f) => f.match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0));
      expect([...lum].sort((a, b) => b - a)).toEqual(lum); // darker and darker
    }
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const L = (color) => {
      const c = color === "#fff" ? "#ffffff" : color;
      const m = c.startsWith("#") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g).slice(0, 3).map(Number);
      const [r, g, b] = m.map((x) => (x / 255 <= 0.03928 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const kind of ["band", "grp"]) {
      for (const n of [3, 4, 5, 7]) {
        for (const { fill, ink } of mixColors(kind, Array.from({ length: n }, (_, i) => (i + 1) / 10))) {
          expect(contrast(L(fill), L(ink))).toBeGreaterThanOrEqual(4.5);
          expect(inkOn(fill)).toBe(ink);
        }
      }
    }
  });

  it("take quartiles from the cumulative shares", () => {
    expect(bandQuartiles([0.3, 0.3, 0.2, 0.2])).toEqual({ p25: 0, median: 1, p75: 2 });
    expect(bandQuartiles([0.1, 0.2, 0.3, 0.4])).toEqual({ p25: 1, median: 2, p75: 3 });
    expect(bandQuartiles([0.25, 0.25, 0.25, 0.25])).toEqual({ p25: 0, median: 1, p75: 2 });
  });
});

describe("mostly zero: the split chart (D6)", () => {
  it("stacks the two halves below a 760 px screen: the share above 0 first, then the range under its heading", async () => {
    await openGenres("#/genres?var=emo_anger_per_1k", 727);
    const halves = [...document.querySelectorAll(".genre-split .split-plot")];
    expect(halves.map((h) => h.className.match(/half-(\w+)/)[1])).toEqual(["share", "range"]);
    expect([...document.querySelectorAll(".split-head")].map((p) => p.textContent)).toEqual([
      "Stories above 0",
      "Among stories above 0 (per 1,000 words)",
    ]);
    expect(halves[0].querySelectorAll(".share-bar").length).toBe(3);
    expect(halves[1].querySelectorAll(".iqr").length).toBe(3);
    const values = [...halves[0].querySelectorAll(".gval")].map((t) => t.textContent);
    expect(values[2]).toMatch(/^▲ \d+%$/); // Romance, marked on its share
    expect(document.querySelector(".genre-list").textContent).toBe("▲ Higher: Romance.");
    expect(document.querySelector(".all-line").textContent).toMatch(
      /^All genres: \d+% of stories are above 0; among those, median [\d.]+ per 1,000 words, interquartile range [\d.]+–[\d.]+\.$/,
    );
    expect(columns()).toEqual([
      "Genre",
      "Stories",
      "Above 0",
      "Median above 0",
      "Interquartile range above 0",
      "Median age",
      "Compared with all genres",
    ]);
  });

  it("puts the two plots side by side from a 760 px screen (a 728 px chart), one row per genre", async () => {
    await openGenres("#/genres?var=emo_anger_per_1k", 728);
    const plots = document.querySelectorAll(".genre-split .split-plot");
    expect(plots).toHaveLength(1);
    expect(document.querySelector(".split-heads").textContent).toBe("Stories above 0Among stories above 0 (per 1,000 words)");
    const rows = [...plots[0].querySelectorAll(".row")];
    expect(rows).toHaveLength(4);
    expect(rows[2].querySelector(".share-bar")).toBeTruthy();
    expect(rows[2].querySelector(".iqr")).toBeTruthy();
    expect(rows[2].getAttribute("aria-label")).toMatch(
      /^Romance: \d+% above 0, among those, median [\d.]+ per 1,000 words, interquartile range [\d.]+–[\d.]+, 120 stories, median age [\d.]+ years, clearly higher than all genres$/,
    );
    expect([...plots[0].querySelectorAll(".reflab")].map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^All genres: \d+%$/),
      expect.stringMatching(/^All genres: [\d.]+$/),
    ]);
    fireEvent.click(rows[2]);
    const card = document.querySelector(".genre-tip");
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "Above 0",
      "Median above 0",
      "Interquartile range above 0",
      "Stories",
      "Median age",
    ]);
  });

  it("works out a genre's share above 0 from its two counts (the file leaves it out)", () => {
    const entry = { k: "zero", fmt: "num", q: [[100], [50]], z: [[40, 0.38, 1, 2, 3], [20, 1.5, 2, 2.5]], r: [null, 0.3], f: [0, 1] };
    const rows = genreRows({ genres: [{ id: "all", name: "All genres" }, { id: "g", name: "G" }] }, { genres: ["all", "g"], age: [5, 6], rule: { min_n: 30 }, c: { x: entry } }, "x");
    expect(rows[0].stats).toEqual({ n: 100, above: 40, share: 0.38, p25: 1, median: 2, p75: 3 });
    expect(rows[1].stats).toEqual({ n: 50, above: 20, share: 0.4, p25: 1.5, median: 2, p75: 2.5 });
    const few = { ...entry, z: [[40, 0.38, 1, 2, 3], [8]] };
    const r2 = genreRows({ genres: [{ id: "all", name: "All genres" }, { id: "g", name: "G" }] }, { genres: ["all", "g"], age: [5, 6], rule: { min_n: 30 }, c: { x: few } }, "x");
    expect(r2[1].stats).toEqual({ n: 50, above: 8, share: 0.16 });
  });
});

describe("the forms on the real data", () => {
  it.skipIf(!real)("never overlap or leave the chart, for every named-group, band and mostly-zero characteristic", () => {
    const problems = [];
    for (const sub of ["all", "y2020", "short"]) {
      const file = realFile(sub);
      for (const [id, entry] of Object.entries(file.c)) {
        if (!["grp", "band", "zero"].includes(entry.k)) continue;
        const variable = real.variables.find((x) => x.id === id);
        const rows = genreRows(real, file, id);
        for (const width of [288, 343, 600, 727, 728, 736, 1032]) {
          let layouts;
          if (entry.k === "zero") {
            const sRows = splitRows(rows, variable, real.min_n);
            const domain = chartDomain(sRows.map((r) => ({ stats: r.above })), "num");
            const args = { rows: sRows, width, domain, printed: (v) => formatNumber(v, entry.fmt), tickFormat: tickFormatFor("zero", entry.fmt) };
            layouts = width >= SPLIT_SIDE ? [splitLayout(args)] : [splitLayout({ ...args, half: "share" }), splitLayout({ ...args, half: "range" })];
          } else {
            layouts = [mixLayout({ rows: mixRows(rows, variable, entry.k, real.min_n), width })];
          }
          for (const layout of layouts) {
            const found = layoutProblems(layout);
            if (found.length) problems.push(`${id}/${sub} @${width}: ${found.length} (${found[0][0]} ${found[0][1].kind})`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it.skipIf(!real)("say where a characteristic peaks with Later / Earlier (F72, an addition to D10)", () => {
    const file = realFile();
    const peak = real.variables.find((x) => x.id === "pace_sex_peak_position");
    const rows = genreRows(real, file, "pace_sex_peak_position");
    expect(takeawayLists(rows, peak, "band").map((l) => `${l.mark} ${l.word}: ${l.names.join(", ")}.`)).toEqual([
      "▼ Earlier: Non-Erotic, Reviews & Essays, How To.",
    ]);
    const howTo = rows.find((r) => r.genre.id === "adult-how-to");
    expect(rowDetails(howTo, peak, file.c.pace_sex_peak_position, 10).name).toMatch(/, clearly earlier than all genres$/);
    expect(comparison(howTo, peak, "band").short).toBe("Clearly earlier"); // the table's words
    // the five peak positions and the 20 of D10 have their own words
    const own = real.variables.filter((x) => x.more_word && x.less_word);
    expect(own).toHaveLength(25);
    expect(own.filter((x) => /_peak_position$/.test(x.id)).map((x) => [x.more_word, x.less_word])).toEqual(
      Array(5).fill(["Later", "Earlier"]),
    );
  });

  it.skipIf(!real)("say the All genres line of narrative perspective as the copy does", () => {
    const file = realFile();
    const rows = genreRows(real, file, "pov_class");
    expect(text(allGenresLine(rows, real.variables.find((x) => x.id === "pov_class"), file.c.pov_class))).toBe(
      "All genres: First person (I) 55%, First person plural (we) 0.1%, Second person (you) 2%, Third person 42%, Mixed 1%.",
    );
    const romance = genreRows(real, file, "rel_romance_per_1k");
    expect(text(allGenresLine(romance, real.variables.find((x) => x.id === "rel_romance_per_1k"), file.c.rel_romance_per_1k))).toBe(
      "All genres: 43% of stories are above 0; among those, median 0.422 per 1,000 words, interquartile range 0.227–0.768.",
    );
    const d = rowDetails(romance.find((r) => r.genre.id === "adult-romance"), real.variables.find((x) => x.id === "rel_romance_per_1k"), file.c.rel_romance_per_1k, 10);
    expect(d.name).toMatch(/^Romance: 73% above 0, among those, median 0\.709 per 1,000 words, interquartile range .*, clearly more than all genres$/);
  });
});
