// The Genres page's other forms (View 1): 100% bars for named groups (grp) and ordered bands (band), and the split
// chart of mostly-zero characteristics (zero, D6); their colors and geometry.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { anyHeading, anyRows } from "../components/GenreAny.jsx";
import { mixRows } from "../components/GenreMix.jsx";
import { clearCache } from "../lib/data.js";
import { BAND_INKS, GROUP_INKS, anyLayout, bandPalette, layoutProblems, mixColors, mixLayout } from "../lib/genreLayout.js";
import { allGenresLine, bandQuartiles, chartDomain, comparison, formatPercent, genreRows, numberFormat, rowDetails, takeawayLists, tickFormatFor } from "../lib/genres.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

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
    expect(rows[2].getAttribute("aria-label")).toMatch(/^Romance: First person \(I\) \d+%, .*, 120 stories, a clearly different mix from all genres$/);
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
  });

  it("give the darkest color to the group that is largest across all genres", () => {
    const c = mixColors("grp", [0.1, 0.55, 0.3, 0.05]);
    expect(c[1]).toEqual({ cls: "pal-group-0", ink: "white" });
    expect(new Set(c.map((x) => x.cls)).size).toBe(4);
    expect(palette().group[0]).toBe("#2b63c6"); // the palette is in palettes.css (F72), which the Trends page shares
  });

  it("name each group over All genres' bar where its segment has room, and outline the near-white group (F72)", async () => {
    await openGenres("#/genres?var=pov_class", 1032);
    const names = [...document.querySelectorAll(".genre-mix .group-name")].map((t) => t.textContent);
    expect(names.length).toBeGreaterThan(0);
    const labels = fixtureMeta.variables.find((x) => x.id === "pov_class").bins.labels;
    for (const n of names) expect(labels).toContain(n);
    // each name sits over the middle of its own segment of the All genres row
    const all = document.querySelector(".genre-mix .row.all");
    for (const t of document.querySelectorAll(".genre-mix .group-name")) {
      const b = labels.indexOf(t.textContent);
      const seg = [...all.querySelectorAll(".segment")].find((r) => r.classList.contains(mixColors("grp", fixtureFile("genres/all.json").c.pov_class.q[0].slice(1))[b].cls));
      expect(Math.abs(Number(seg.getAttribute("x")) + Number(seg.getAttribute("width")) / 2 - Number(t.getAttribute("x")))).toBeLessThan(0.01);
    }
    const css = readFileSync(path.join(here, "..", "palettes.css"), "utf8"); // with the palettes, for every 100% bar
    expect(css).toMatch(/\.genre-mix \.segment\.pal-group-4,\s*\.profile-plot \.segment\.pal-group-4 \{\s*stroke: #a5a29a;/);
  });

  it("leave names out where their segments are too narrow, and never let them overlap, at every width", () => {
    const labels = ["First person (I)", "First person plural (we)", "Second person (you)", "Third person", "Mixed"];
    const rows = [
      { index: 0, label: "All genres", n: 900, shares: [0.553, 0.001, 0.022, 0.416, 0.008], mark: "" },
      { index: 1, label: "Romance", n: 300, shares: [0.2, 0.0, 0.05, 0.7, 0.05], mark: "≠" },
    ];
    for (const width of [288, 343, 600, 768, 1032]) {
      const layout = mixLayout({ rows, width, labels });
      expect(layoutProblems(layout)).toEqual([]);
      for (const nm of layout.names) expect(["First person (I)", "Third person"]).toContain(nm.text); // the small ones never fit
    }
  });
});

/** The palettes as palettes.css writes them: { group: [hex…], bands: { 5: [hex…], 7: [hex…], … } }. */
function palette() {
  const css = readFileSync(path.join(here, "..", "palettes.css"), "utf8");
  const vars = (block, name) => [...block.matchAll(new RegExp(`--${name}-(\\d+): (#[0-9a-f]{6});`, "g"))].map((m) => m[2]);
  const group = vars(css.match(/\.genres-page,\s*\.trends-page \{([^}]*)\}/)[1], "group");
  const bands = {};
  for (const m of css.matchAll(/\.bands-(\d+) \{([^}]*)\}/g)) bands[m[1]] = vars(m[2], "band");
  return { group, bands };
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const INK_HEX = { white: "#ffffff", dark: "#1c1c22" };

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
      "Romance: median 6–20, 1 story 10%, 2–5 20%, 6–20 30%, 21–50 40%, 120 stories, clearly higher than all genres",
    );
    expect(screen.queryByRole("radiogroup", { name: "Order" })).toBeNull(); // bands are not put in order
    // the legend keeps the general words, whatever the band's own words (Later / Earlier for the peak positions)
    expect(document.querySelector(".genre-legend").textContent).toMatch(/▲▼ Clearly higher or lower than all genres/);
  });

  it("go from light to dark on an even scale of contrast, with shares printed only in an ink that reaches 4.5:1 (F72)", () => {
    const { group, bands } = palette();
    expect(Object.keys(bands).map(Number)).toEqual([3, 4, 5, 6, 7, 8]);
    for (const [n, colors] of Object.entries(bands)) {
      expect(colors).toHaveLength(Number(n));
      expect([colors[0], colors[colors.length - 1]]).toEqual(["#e1ebfd", "#1d4a99"]);
      const steps = colors.slice(1).map((c, i) => contrast(colors[i], c));
      for (const step of steps) expect(step).toBeGreaterThanOrEqual(1.3); // neighbors stay apart
      expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.04); // and differ equally
      colors.forEach((c, i) => {
        const ink = BAND_INKS[n][i];
        if (ink) expect(contrast(c, INK_HEX[ink])).toBeGreaterThanOrEqual(4.5);
        else expect(Math.max(contrast(c, INK_HEX.white), contrast(c, INK_HEX.dark))).toBeLessThan(4.5);
      });
    }
    expect(bands[7].slice(1).map((c, i) => contrast(bands[7][i], c).toFixed(2))).toEqual(["1.39", "1.38", "1.37", "1.40", "1.36", "1.40"]);
    group.forEach((c, i) => expect(contrast(c, INK_HEX[GROUP_INKS[i]])).toBeGreaterThanOrEqual(4.5));
    // every band of a chart has its palette's color and ink
    for (const n of [4, 5, 7]) {
      const colors = mixColors("band", Array(n).fill(1 / n));
      expect(colors.map((c) => c.cls)).toEqual(Array.from({ length: n }, (_, b) => `pal-band-${b}`));
      expect(colors.map((c) => c.ink)).toEqual(BAND_INKS[bandPalette(n)]);
    }
  });

  it("take quartiles from the cumulative shares", () => {
    expect(bandQuartiles([0.3, 0.3, 0.2, 0.2])).toEqual({ p25: 0, median: 1, p75: 2 });
    expect(bandQuartiles([0.1, 0.2, 0.3, 0.4])).toEqual({ p25: 1, median: 2, p75: 3 });
    expect(bandQuartiles([0.25, 0.25, 0.25, 0.25])).toEqual({ p25: 0, median: 1, p75: 2 });
  });
});

describe("mostly zero: one chart (D6, concept M1)", () => {
  it("draws one row per genre: its mark beside its name, the range among stories with any, the median and the share", async () => {
    await openGenres("#/genres?var=emo_anger_per_1k", 1032);
    const chart = document.querySelector(".genre-any");
    expect(chart.querySelectorAll("svg[role=group]")).toHaveLength(1); // one chart, one tab stop
    expect(chart.querySelectorAll(".row[tabindex='0']")).toHaveLength(1);
    expect(document.querySelector(".any-head").textContent).toBe("Among stories with any (per 1,000 words)");
    expect([...chart.querySelectorAll(".col-head, .stories-head")].map((t) => t.textContent)).toEqual(["Median", "With any", "Stories"]);
    const rows = [...chart.querySelectorAll(".row")];
    expect(rows).toHaveLength(4);
    const romance = rows[2];
    expect(romance.querySelector(".gmark").textContent).toBe("▲"); // in the mark column, beside the name (F61a)
    expect(Number(romance.querySelector(".gmark").getAttribute("x"))).toBeLessThan(Number(romance.querySelector(".iqr").getAttribute("x")));
    expect([...romance.querySelectorAll(".gval")].map((t) => t.textContent)).toEqual([expect.stringMatching(/^[\d.]+$/), expect.stringMatching(/^\d+%$/)]);
    expect(romance.querySelector(".share-bar")).toBeTruthy();
    expect(romance.getAttribute("aria-label")).toMatch(
      /^Romance: \d+% with any, among those, median [\d.]+ per 1,000 words, interquartile range [\d.]+–[\d.]+, 120 stories, clearly higher than all genres$/,
    );
    expect(rows[3].querySelector(".gnone").textContent).toBe("Fewer than 10 stories");
    expect(chart.querySelector(".reflab").textContent).toMatch(/^All genres: [\d.]+$/);
    // the words: "with any" everywhere (F79)
    expect(document.querySelector(".genre-list").textContent).toBe("▲ Higher: Romance.");
    expect(document.querySelector(".all-line").textContent).toMatch(
      /^All genres: \d+% of stories have any; among those, median [\d.]+ per 1,000 words, interquartile range [\d.]+–[\d.]+\.$/,
    );
    expect(document.querySelector(".genre-legend").textContent).toMatch(/^\s*Median and interquartile range among stories with any▲▼ Clearly higher/);
    expect(document.querySelector(".genre-legend").textContent).not.toMatch(/Share of stories/);
    expect(screen.getByRole("radio", { name: "By share with any" })).toBeTruthy();
    fireEvent.click(romance);
    const card = document.querySelector(".genre-tip");
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "With any",
      "Median among those",
      "Interquartile range among those",
      "Stories",
    ]);
  });

  it("puts the median over the share on phones, under “Median” over “with any”", async () => {
    await openGenres("#/genres?var=emo_anger_per_1k", 343);
    const chart = document.querySelector(".genre-any");
    expect([...chart.querySelectorAll(".col-head")].map((t) => t.textContent)).toEqual(["Median", "with any"]);
    expect(chart.querySelector(".stories-head")).toBeNull();
    const romance = [...chart.querySelectorAll(".row")][2];
    const [median, share] = [...romance.querySelectorAll(".gval")];
    expect(Number(median.getAttribute("y"))).toBeLessThan(Number(share.getAttribute("y")));
    expect(share.classList.contains("any-share")).toBe(true);
    expect(romance.querySelector(".share-bar")).toBeNull();
    expect(document.querySelector(".any-head").style.paddingLeft).toBe(""); // from the chart's left edge
  });

  it("says when a genre has stories but too few with any", () => {
    const rows = [
      { index: 0, label: "All genres", n: 900, share: 0.4, above: { n: 360, p25: 1, median: 2, p75: 3 }, mark: "", noneText: "x", fewAboveText: "Fewer than 10 stories with any" },
      { index: 1, label: "Fetish", n: 300, share: 0.02, above: null, mark: "▼", noneText: "x", fewAboveText: "Fewer than 10 stories with any" },
    ];
    for (const width of [288, 343, 728, 1032]) {
      const layout = anyLayout({ rows, width, domain: [0, 3.2], printed: String, shareText: formatPercent });
      expect(layout.rows[1].fewAbove.text).toBe("Fewer than 10 stories with any");
      expect(layout.rows[1].share.text).toBe("2%");
      expect(layout.rows[1].mark.text).toBe("▼");
      expect(layoutProblems(layout)).toEqual([]);
    }
  });

  it("works out a genre's share above 0 from its two counts (the file leaves it out)", () => {
    const entry = { k: "zero", fmt: "num", q: [[100], [50]], z: [[40, 0.38, 1, 2, 3], [20, 1.5, 2, 2.5]], r: [null, 0.3], f: [0, 1] };
    const rows = genreRows({ genres: [{ id: "all", name: "All genres" }, { id: "g", name: "G" }] }, { genres: ["all", "g"], rule: { min_n: 30 }, c: { x: entry } }, "x");
    expect(rows[0].stats).toEqual({ n: 100, above: 40, share: 0.38, p25: 1, median: 2, p75: 3 });
    expect(rows[1].stats).toEqual({ n: 50, above: 20, share: 0.4, p25: 1.5, median: 2, p75: 2.5 });
    const few = { ...entry, z: [[40, 0.38, 1, 2, 3], [8]] };
    const r2 = genreRows({ genres: [{ id: "all", name: "All genres" }, { id: "g", name: "G" }] }, { genres: ["all", "g"], rule: { min_n: 30 }, c: { x: few } }, "x");
    expect(r2[1].stats).toEqual({ n: 50, above: 8, share: 0.16 });
  });
});

describe("no median age in a genre's details, in any form (decision 4)", () => {
  const FORMS = [
    ["dlg_word_share", ".genre-chart.kind-num"],
    ["dlg_has_dialogue", ".genre-chart.kind-bin"],
    ["emo_anger_per_1k", ".genre-any"],
    ["pov_class", ".genre-mix.kind-grp"],
    ["author_stories_count", ".genre-mix.kind-band"],
  ];

  it.each(FORMS)("%s: not in the card, the phone's line or the rows' names", async (v, chart) => {
    await openGenres(`#/genres?var=${v}`, 1032);
    let rows = [...document.querySelectorAll(`${chart} .row`)];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.getAttribute("aria-label")).not.toMatch(/median age|years/);
    fireEvent.click(rows[2]); // Romance
    const card = document.querySelector(".genre-tip");
    expect(card.querySelector("strong").textContent).toBe("Romance");
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).not.toContain("Median age");
    expect(card.textContent).not.toMatch(/median age|years/i);
    expect([...card.querySelectorAll("dt")].pop().textContent).toBe("Stories");

    vi.restoreAllMocks();
    clearCache();
    document.body.innerHTML = "";
    await openGenres(`#/genres?var=${v}`, 343);
    rows = [...document.querySelectorAll(`${chart} .row`)];
    fireEvent.click(rows[2]);
    const line = document.querySelector(".genre-line");
    expect(line.textContent).toMatch(/^Romance /);
    expect(line.textContent).not.toMatch(/median age|years/i);
  });
});

describe("no highlighted genre, in any form (decision 8)", () => {
  it.each([
    ["pov_class", ".genre-mix"],
    ["author_stories_count", ".genre-mix"],
    ["emo_anger_per_1k", ".genre-any"],
  ])("%s: an old link's genre draws no second row, and the address drops it", async (v, chart) => {
    await openGenres(`#/genres?var=${v}&genre=romance`);
    const rows = [...document.querySelectorAll(`${chart} .row`)];
    expect(rows.map((r) => r.querySelector(".glabel").textContent)).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    expect(document.querySelector(".row.repeat, .row.highlight, .band-highlight")).toBeNull();
    expect(document.querySelectorAll(`${chart} .band-all`)).toHaveLength(1); // All genres keeps its band
    await waitFor(() => expect(window.location.hash).toBe(`#/genres?var=${v}&include=all`));
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
            const aRows = anyRows(rows, variable, real.min_n);
            const domain = chartDomain(aRows.map((r) => ({ stats: r.above })), "num");
            const nf = numberFormat(variable, entry);
            layouts = [anyLayout({ rows: aRows, width, domain, printed: nf.value, shareText: formatPercent, tickFormat: tickFormatFor("zero", entry.fmt) })];
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
      "▼ Earlier: Non-Erotic, Reviews & Essays.",
    ]);
    const nonErotic = rows.find((r) => r.genre.id === "non-erotic-stories"); // How To until the data update 20261013
    expect(rowDetails(nonErotic, peak, file.c.pace_sex_peak_position, 10).name).toMatch(/, clearly earlier than all genres$/);
    expect(comparison(nonErotic, peak, "band").short).toBe("Clearly earlier"); // the table's words
    // the five peak positions and the 20 of D10 have their own words
    const own = real.variables.filter((x) => x.more_word && x.less_word);
    expect(own).toHaveLength(25);
    expect(own.filter((x) => /_peak_position$/.test(x.id)).map((x) => [x.more_word, x.less_word])).toEqual(
      Array(5).fill(["Later", "Earlier"]),
    );
  });

  it.skipIf(!real)("put How To's ▲ for repeated five-word phrases beside its name, not beside its share (F61)", () => {
    const file = realFile();
    const variable = real.variables.find((x) => x.id === "rep_repeated_5gram_per_1k");
    const entry = file.c.rep_repeated_5gram_per_1k;
    const rows = genreRows(real, file, "rep_repeated_5gram_per_1k");
    const nf = numberFormat(variable, entry);
    const aRows = anyRows(rows, variable, real.min_n);
    for (const width of [343, 1032]) {
      const layout = anyLayout({ rows: aRows, width, domain: chartDomain(aRows.map((r) => ({ stats: r.above })), "num"), printed: nf.value, shareText: formatPercent });
      const howTo = layout.rows[rows.findIndex((r) => r.genre.id === "adult-how-to")];
      expect(howTo.mark.text).toBe("▲");
      expect(howTo.mark.x).toBeLessThan(layout.x0); // the mark column, before the plot
      expect(howTo.share.text).toBe("80%"); // the share alone
      expect(howTo.median.text).toBe("2.530"); // all genres' quartiles among those with any (0.652, 1.18, 2.15) give three decimals
    }
    expect(anyHeading(nf)).toBe("Among stories with any (per 1,000 words)");
  });

  it.skipIf(!real)("leave out “Genre medians run from X to X” when both ends are the same (F72)", () => {
    const file = realFile();
    const line = (id) => text(allGenresLine(genreRows(real, file, id), real.variables.find((x) => x.id === id), file.c[id]));
    expect(line("pace_descriptive_peak_position")).toBe("All genres: median middle, interquartile range 2nd fifth to 4th fifth.");
    expect(line("pace_sex_peak_position")).toMatch(/ Genre medians run from .* to .*\.$/);
    for (const [id, entry] of Object.entries(file.c)) {
      if (entry.k !== "num" && entry.k !== "band") continue;
      expect(line(id)).not.toMatch(/run from (\S+) to \1\./);
    }
  });

  it.skipIf(!real)("say the All genres line of narrative perspective as the copy does", () => {
    const file = realFile();
    const rows = genreRows(real, file, "pov_class");
    expect(text(allGenresLine(rows, real.variables.find((x) => x.id === "pov_class"), file.c.pov_class))).toBe(
      // shares under 1% take a decimal (F66): "Mixed 0.8%", where the first copy said 1%
      "All genres: First person (I) 55%, First person plural (we) 0.1%, Second person (you) 2%, Third person 42%, Mixed 0.8%.",
    );
    const romance = genreRows(real, file, "rel_romance_per_1k");
    expect(text(allGenresLine(romance, real.variables.find((x) => x.id === "rel_romance_per_1k"), file.c.rel_romance_per_1k))).toBe(
      "All genres: 44% of stories have any; among those, median 0.418 per 1,000 words, interquartile range 0.228–0.787.",
    );
    const d = rowDetails(romance.find((r) => r.genre.id === "adult-romance"), real.variables.find((x) => x.id === "rel_romance_per_1k"), file.c.rel_romance_per_1k, 10);
    expect(d.name).toMatch(/^Romance: 72% with any, among those, median 0\.743 per 1,000 words, interquartile range .*, clearly more than all genres$/);
    expect(d.line).toMatch(/^72% with any · among those, median 0\.743 per 1,000 words · interquartile range /);
  });
});
