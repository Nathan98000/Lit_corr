// Charts whose values don't vary (a follow-up to the data update of 2026-10-13): every quartile the same, in every
// period on the Trends page (How To's pages on site: 1 page, IQR 1–1, in each) or in every genre on the Genres page
// ("Under 2,000 words": 1 page in each). They have no spread to zoom on, and the 4% padding around the value drew an
// axis of 0.96 to 1.04 pages. Now they are drawn against 0: from 0 to twice the value, with ticks at 0, the value and
// twice the value (flatDomain), so the line sits halfway up on a labeled value.
import { render } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrendChart from "../components/TrendChart.jsx";
import { anyLayout } from "../lib/genreLayout.js";
import { chartDomain, chartRows, flatDomain, formatPercent, genreRows, numberFormat, printedFor, tickFormatFor } from "../lib/genres.js";
import { rangeLayout } from "../lib/rangeLayout.js";
import { trendDomain, trendLayout, trendOverlaps, trendTicks } from "../lib/trendLayout.js";
import { trendChartInput, trendSplitInputs } from "../lib/trends.js";
import { onGenresPageSubset } from "../lib/urlState.js";
import { fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const AGG = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const realJson = (rel) => JSON.parse(readFileSync(path.join(AGG, rel), "utf8"));

afterEach(() => {
  vi.restoreAllMocks();
});

const FILE = {
  g: "all",
  s: "all",
  rule: { min_r: 0.2, z: 3.29, min_tvd: 0.2, min_n: 30 },
  periods: [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
  then: [2000, 2009],
  now: [2020, 2026],
};
const PAGES = { id: "story_pages", label: "Pages on site", noun: "number of pages", unit: "pages", bins: { type: "ranges" } };
const flatPages = { k: "num", fmt: "num", q: FILE.periods.map(() => [100, 1, 1, 1]), t: [200, 1, 1, 1], r: 0.186, f: 0 };
/** The values a chart's cells draw: every quartile shown. */
const quartiles = (cells) => cells.filter(Boolean).flatMap((c) => [c.p25, c.median, c.p75]);
const isFlat = (vals) => vals.length > 0 && vals.every((v) => v === vals[0]);
/** The ticks the rule gives a value: 0, the value and twice the value (0, 1 and 2 for 0; numbers only). */
const expectedTicks = (v) => (v === 0 ? [0, 1, 2] : v > 0 ? [0, v, 2 * v] : [2 * v, v, 0]);

describe("the rule (flatDomain)", () => {
  it("draws a value that doesn't vary against 0: from 0 to twice it, a tick at 0, at the value and at twice it", () => {
    expect(flatDomain([1, 1, 1, 1])).toEqual([0, 2, 1]);
    expect(flatDomain([6, 6, 6])).toEqual([0, 12, 6]);
    expect(flatDomain([0, 0, 0])).toEqual([0, 2, 1]); // on the baseline, with whole-number ticks
    expect(flatDomain([-0.5, -0.5])).toEqual([-1, 0, 0.5]); // mirrored under 0
    // percentages keep a share's axis (as yes/no charts have): from 0 to the smallest of 25, 50, 75 and 100% that holds it
    expect(flatDomain([0], "percent")).toEqual([0, 0.25, 0.05]);
    expect(flatDomain([0.2, 0.2], "percent")).toEqual([0, 0.25, 0.05]);
    expect(flatDomain([0.6], "percent")).toEqual([0, 0.75, 0.25]);
    expect(flatDomain([-0.3], "percent")).toEqual([-0.5, 0, 0.1]);
    expect(flatDomain([2005, 2005], "year")).toEqual([2004, 2006, 1]); // a year either side
    // values that vary keep the usual axis
    expect(flatDomain([1, 1, 2])).toBeNull();
    expect(flatDomain([])).toBeNull();
    expect(chartDomain([{ stats: { p25: 1, median: 1, p75: 2 } }, { stats: { p25: 1, median: 1, p75: 1 } }], "num")).toHaveLength(2);
    expect(trendDomain("num", [{ p25: 1, median: 1, p75: 2 }, null, { p25: 1, median: 1, p75: 1 }])).toHaveLength(2);
  });

  it("gives the Trends page's axis a tick every step, the same on both pages", () => {
    const cells = [{ p25: 1, median: 1, p75: 1 }, null, { p25: 1, median: 1, p75: 1 }];
    expect(trendDomain("num", cells)).toEqual([0, 2, 1]);
    expect(chartDomain(cells.filter(Boolean).map((stats) => ({ stats })), "num")).toEqual([0, 2, 1]);
    expect(trendTicks("num", [0, 2, 1])).toEqual({ lo: 0, hi: 2, step: 1, ticks: [0, 1, 2] });
    expect(trendTicks("num", trendDomain("num", [{ p25: 6, median: 6, p75: 6 }]))).toEqual({ lo: 0, hi: 12, step: 6, ticks: [0, 6, 12] });
    expect(trendTicks("num", trendDomain("num", [{ p25: 0.6, median: 0.6, p75: 0.6 }], "percent")).ticks).toEqual([0, 0.25, 0.5, 0.75]);
    expect(trendTicks("bin", [0, 0.5]).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]); // shares as before
  });
});

describe("the Trends page", () => {
  it("draws 1 page in every period halfway up an axis of 0, 1 and 2 pages, at every width", () => {
    const input = trendChartInput(fixtureMeta, PAGES, flatPages, FILE);
    expect(input.axis).toEqual({ lo: 0, hi: 2, step: 1, ticks: [0, 1, 2] });
    for (const width of [288, 343, 736, 760]) {
      const layout = trendLayout({ width, ...input });
      expect(layout.ticks.map((t) => t.text)).toEqual(["0", "1", "2"]);
      for (const c of layout.columns) expect(c.dotY).toBeCloseTo((layout.top + layout.bottom) / 2, 6);
      expect(trendOverlaps(layout)).toEqual([]);
    }
  });

  it("puts a value of 0 on the baseline and labels whole numbers", () => {
    const zero = { ...flatPages, q: FILE.periods.map(() => [100, 0, 0, 0]), t: [200, 0, 0, 0] };
    const layout = trendLayout({ width: 343, ...trendChartInput(fixtureMeta, PAGES, zero, FILE) });
    expect(layout.ticks.map((t) => t.text)).toEqual(["0", "1", "2"]);
    for (const c of layout.columns) expect(c.dotY).toBeCloseTo(layout.bottom, 6);
  });

  it("gives the same axis to the split chart's half among stories with any", () => {
    const RATE = { id: "emo_anger_per_1k", label: "Anger", noun: "anger", unit: "per 1,000 words", bins: { type: "ranges" } };
    // a mostly-zero characteristic in All genres: [stories, with any, share with any, p25, median, p75] among those
    const cell = [100, 40, 0.4, 2, 2, 2];
    const entry = { k: "zero", fmt: "num", q: FILE.periods.map(() => cell), t: [200, 80, 0.4, 2, 2, 2], r: 0.01, f: 0 };
    const [, among] = trendSplitInputs(fixtureMeta, RATE, entry, FILE);
    expect(among.input.axis.ticks).toEqual([0, 2, 4]);
  });

  it("writes the axis's labels on the page: 0, 1 and 2, with no 0.96 or 1.04", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    render(<TrendChart meta={fixtureMeta} variable={PAGES} entry={flatPages} file={FILE} title="Pages on site in How To" />);
    const ticks = [...document.querySelectorAll(".trend-chart svg .tick-mark text")].map((t) => t.textContent);
    expect(ticks).toEqual(["0", "1", "2"]);
  });
});

describe("the Genres page", () => {
  const rows = (v) =>
    ["All genres", "Anal", "BDSM"].map((label, index) => ({ index, label, stats: { n: 100 + index, p25: v, median: v, p75: v }, mark: "" }));
  const layoutAt = (width, rs) =>
    rangeLayout({
      rows: rs,
      overall: rs[0].stats,
      format: "count",
      width,
      smallN: 30,
      minN: 10,
      domain: chartDomain(rs, "num"),
      valueColumn: true,
      storiesColumn: true,
      markColumn: true,
      valueHead: "Median",
      phoneLabelW: 116,
      rowHeight: 31,
    });

  it("draws 1 page in every genre halfway across an axis of 0, 1 and 2 pages, at every width", () => {
    for (const width of [288, 343, 720, 1032]) {
      const layout = layoutAt(width, rows(1));
      expect(layout.ticks.map((t) => t.text)).toEqual(["0", "1", "2"]);
      for (const r of layout.rows) expect(r.dotX).toBeCloseTo(layout.x(1), 6);
      expect(layout.x(1)).toBeCloseTo((layout.x(0) + layout.x(2)) / 2, 6);
    }
  });

  it("gives the same axis to a mostly-zero characteristic's plot among stories with any", () => {
    const aRows = [0, 1].map((index) => ({ index, label: index ? "Anal" : "All genres", n: 100, share: 0.4, above: { n: 40, p25: 2, median: 2, p75: 2 }, mark: "" }));
    const layout = anyLayout({ rows: aRows, width: 1032, domain: chartDomain(aRows.map((r) => ({ stats: r.above })), "num"), printed: String, shareText: formatPercent });
    expect(layout.ticks.map((t) => t.text)).toEqual(["0", "2", "4"]);
  });
});

describe("on the real data", () => {
  it.skipIf(!real)("draws every chart whose values don't vary against 0, the Trends page's and the Genres page's", () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    let trends = 0;
    for (const sub of real.trend.subsets) {
      for (const name of readdirSync(path.join(AGG, "trends", sub))) {
        const file = realJson(`trends/${sub}/${name}`);
        for (const [id, entry] of Object.entries(file.c)) {
          const input =
            entry.k === "num" ? trendChartInput(real, byId.get(id), entry, file) : entry.k === "zero" ? trendSplitInputs(real, byId.get(id), entry, file)[1].input : null;
          const vals = input ? quartiles(input.cells) : [];
          if (!isFlat(vals) || entry.fmt !== "num") continue;
          trends += 1;
          expect(input.axis.ticks, `${sub}/${name} ${id}`).toEqual(expectedTicks(vals[0]));
        }
      }
    }
    let genres = 0;
    for (const s of real.subsets.filter(onGenresPageSubset)) {
      const file = realJson(`genres/${s.id}.json`);
      for (const [id, entry] of Object.entries(file.c)) {
        if (entry.k !== "num" || entry.fmt !== "num") continue;
        const rows = chartRows(genreRows(real, file, id), byId.get(id), "num");
        const vals = rows.filter((r) => r.stats).flatMap((r) => [r.stats.p25, r.stats.median, r.stats.p75]);
        if (!isFlat(vals)) continue;
        genres += 1;
        const [lo, hi, step] = chartDomain(rows, "num", entry.fmt);
        expect([lo, hi, step], `${s.id} ${id}`).toEqual([0, 2 * vals[0] || 2, vals[0] || 1]);
      }
    }
    // the 20261013 data: 41 on the Trends page (pages on site, sex scenes in Non-Erotic …); none on the Genres page since
    // its options are the year published alone (the owner, 2026-10-20: its one was pages on site with Under 2,000
    // words), so the next test draws one from a made-up file
    expect(trends).toBeGreaterThan(0);
    expect(genres).toBe(0);
  });

  it.skipIf(!real)("shows How To's 1 page in every period on 0, 1 and 2 pages, and every genre's when all have 1 page", () => {
    const pages = real.variables.find((v) => v.id === "story_pages");
    const file = realJson("trends/all/adult-how-to.json");
    const layout = trendLayout({ width: 343, ...trendChartInput(real, pages, file.c.story_pages, file) });
    expect(layout.ticks.map((t) => t.text)).toEqual(["0", "1", "2"]);
    for (const c of layout.columns) expect(c.dotY).toBeCloseTo((layout.top + layout.bottom) / 2, 6);
    // every genre's stories on 1 page, as with Under 2,000 words before the owner's 2026-10-20
    const flat = realJson("genres/all.json");
    flat.c.story_pages.q = flat.c.story_pages.q.map((c, i) => c && (i === 0 ? [c[0], 1, 1, 1, 1, 1] : [c[0], 1, 1, 1]));
    const entry = flat.c.story_pages;
    const crow = chartRows(genreRows(real, flat, "story_pages"), pages, "num");
    for (const width of [343, 1032]) {
      const g = rangeLayout({
        rows: crow,
        overall: crow[0].stats,
        format: "count",
        width,
        smallN: real.small_n,
        minN: real.min_n,
        domain: chartDomain(crow, "num", entry.fmt),
        tickFormat: tickFormatFor("num", entry.fmt),
        printed: printedFor("num", numberFormat(pages, entry)),
        valueColumn: true,
        storiesColumn: true,
        markColumn: true,
        valueHead: "Median",
        phoneLabelW: 116,
        rowHeight: 31,
      });
      expect(g.ticks.map((t) => t.text)).toEqual(["0", "1", "2"]);
      expect(g.rows.filter((r) => r.dotX != null).every((r) => Math.abs(r.dotX - g.x(1)) < 1e-6)).toBe(true);
    }
  });
});
