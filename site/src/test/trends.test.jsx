// The Trends page's View 1 (STAGE2_TRENDS_PAGE_PROMPT.md, section 3): the chart's geometry (trendLayout), its numbers,
// every heading, the takeaway's lines and the fixed-mix line, the chart on the page (marks, table, brackets, details and
// keyboard, small samples), the too-few states, the actions and the PNG's parts.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { TrendLegend, trendsImage } from "../components/TrendAnswer.jsx";
import TrendChart from "../components/TrendChart.jsx";
import TrendMix from "../components/TrendMix.jsx";
import useRowDetails from "../components/useRowDetails.js";
import { keyItems } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import {
  SPLIT_SIDE_FROM,
  TWO_LINES_UNDER,
  mixSegments,
  periodLabel,
  periodLines,
  splitLayout,
  splitOverlaps,
  trendDomain,
  trendLayout,
  trendOverlaps,
  trendTicks,
} from "../lib/trendLayout.js";
import { formatPercent } from "../lib/genres.js";
import {
  borderlineLine,
  numbersLine,
  periodWords,
  trendAxisTitle,
  trendChartInput,
  trendFormat,
  trendHeading,
  trendCells,
  trendMixColors,
  trendMixGroups,
  trendSplitInputs,
  trendsFileName,
  yesPhrase,
} from "../lib/trends.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realTrends = (sub, g) =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "trends", sub, `${g}.json`), "utf8"));
const css = readFileSync(path.join(here, "..", "trends.css"), "utf8");

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens a Trends address with the chart `width` px wide (`change`: a function that edits the trends files served). */
async function openTrends(hash, { width = 720, change = null } = {}) {
  if (change) {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("trends/")) return res;
      const body = change(await res.json(), String(url));
      return { ok: true, status: 200, json: async () => body };
    });
  }
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".trends-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const FILE = {
  g: "all",
  s: "all",
  rule: { min_r: 0.2, z: 3.29, min_tvd: 0.2, min_n: 30 },
  periods: [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
  then: [2000, 2009],
  now: [2020, 2026],
};
const WORDS = { id: "story_words", label: "Word count", noun: "story length in words", unit: "words", bins: { type: "ranges" } };
const NOTE = { id: "story_has_author_note", label: "Has an author’s note", noun: "has an author’s note", unit: "yes/no", bins: { type: "levels" }, yes_subject: "Stories with an author’s note" };
const ALL = { id: "all", name: "All genres" };
const ROMANCE = { id: "adult-romance", name: "Romance" };
const OPTION = { id: "short", label: "Under 2,000 words" };
const num = (q, t, r, f, more = {}) => ({ k: "num", fmt: "num", q, t, r, f, ...more });

describe("the chart's geometry (trendLayout)", () => {
  it("labels the periods, on two lines in columns under 58 px", () => {
    expect(FILE.periods.map(periodLabel)).toEqual(["2000–04", "2005–09", "2010–14", "2015–19", "2020–26"]);
    expect(periodLines([2000, 2004])).toEqual(["2000", "–04"]);
    expect(periodLabel([1999, 2003])).toBe("1999–2003");
    const input = trendChartInput(fixtureMeta, WORDS, num(FILE.periods.map(() => [100, 1, 2, 3]), [100, 1, 2, 3], 0.1, 0), FILE);
    const narrow = trendLayout({ width: 288, ...input });
    const wide = trendLayout({ width: 736, ...input });
    expect(narrow.colW).toBeLessThan(TWO_LINES_UNDER);
    expect(narrow.columns[0].lines.map((l) => l.text)).toEqual(["2000", "–04"]);
    expect(wide.columns[0].lines.map((l) => l.text)).toEqual(["2000–04"]);
    expect(trendLayout({ width: 1200, ...input }).width).toBe(760); // at most 760 px wide
  });

  it("says Fewer than 10 on as many lines as a column needs, never leaving the number alone", () => {
    const some = [100, 1, 2, 3];
    const input = trendChartInput(fixtureMeta, WORDS, num([null, some, some, some, some], some, 0.1, 0), FILE);
    const lines = (width) => trendLayout({ width, ...input }).columns[0].none.map((l) => l.text);
    expect(lines(288)).toEqual(["Fewer", "than", "10"]);
    expect(lines(343)).toEqual(["Fewer", "than 10"]);
    expect(lines(736)).toEqual(["Fewer than 10"]);
  });

  it("draws every mark inside the plot when the ticks stop short of the domain's top", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 736, height: 0, top: 0, left: 0, right: 736, bottom: 0 });
    // story length in Romance: the quartiles reach 11,200, the ticks stop at 10,000
    const q = [[32, 1450, 2160, 3450], [55, 1980, 3250, 5180], [44, 2100, 4350, 7170], [69, 3700, 5870, 11200], [100, 2900, 5170, 9700]];
    const entry = num(q, [87, 1700, 2930, 4400], 0.385, 1);
    const input = trendChartInput(fixtureMeta, WORDS, entry, FILE);
    expect(input.axis.ticks[input.axis.ticks.length - 1]).toBe(10000);
    expect(input.axis.hi).toBeGreaterThan(11200);
    const layout = trendLayout({ width: 736, ...input });
    render(<TrendChart meta={fixtureMeta} variable={WORDS} entry={entry} file={FILE} title="Story length in Romance" />);
    const tops = [...document.querySelectorAll(".trend-chart .iqr")].map((r) => Number(r.getAttribute("y")));
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(layout.top - 0.01);
    expect(Math.min(...tops)).toBeCloseTo(layout.y(11200), 5);
  });

  it("brackets the two windows compared, their labels inside the chart", () => {
    const input = trendChartInput(fixtureMeta, WORDS, num(FILE.periods.map(() => [100, 1, 2, 3]), [100, 1, 2, 3], 0.1, 0), FILE);
    for (const width of [288, 343, 736, 760]) {
      const layout = trendLayout({ width, ...input });
      expect(layout.brackets.map((b) => b.label)).toEqual(["2000–2009", "2020 or later"]);
      const [then, now] = layout.brackets;
      expect(then.x0).toBeGreaterThan(layout.columns[0].x0);
      expect(then.x1).toBeLessThan(layout.columns[1].x1);
      expect(now.x0).toBeGreaterThan(layout.columns[4].x0);
      expect(trendOverlaps(layout)).toEqual([]);
    }
  });

  it("prints long values smaller on a phone, and drops every other one a line when even 11.5 px would crowd them", () => {
    const input = (values) => ({
      ...trendChartInput(fixtureMeta, WORDS, num(FILE.periods.map(() => [100, -1, 0, 1]), [100, -1, 0, 1], 0, 0), FILE),
      texts: values.map((value) => ({ value, stories: "100" })),
    });
    const hedge = input(["−0.125", "−0.154", "−0.176", "−0.138", "−0.163"]);
    expect(trendLayout({ width: 736, ...hedge }).valueSize).toBe(13);
    expect(trendLayout({ width: 343, ...hedge }).valueSize).toBe(13);
    const phone = trendLayout({ width: 288, ...hedge });
    expect([phone.valueSize, phone.stagger]).toEqual([11.5, false]);
    expect(new Set(phone.columns.map((c) => c.value.y)).size).toBe(1);
    const tiny = trendLayout({ width: 288, ...input(["0.78", "0.00060", "0.0032", "3.04", "0.00"]) });
    expect(tiny.stagger).toBe(true);
    expect(tiny.columns.map((c) => c.value.y - tiny.columns[0].value.y)).toEqual([0, 15, 0, 15, 0]);
    expect(tiny.columns[0].stories.y - tiny.columns[0].value.y).toBe(33);
    expect(trendOverlaps(tiny)).toEqual([]);
  });

  it("sets the axis: shares from 0 to 25, 50, 75 or 100%; numbers from 0 when the lowest is near, in three to five ticks", () => {
    const shares = (top) => trendDomain("bin", [{ share: top }, null, { share: 0.01 }]);
    expect([0.2, 0.33, 0.6, 0.9].map((t) => shares(t)[1])).toEqual([0.25, 0.5, 0.75, 1]);
    expect(trendTicks("bin", [0, 0.5]).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(trendTicks("bin", [0, 1]).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    // the lowest quartile within half the span: from 0
    expect(trendDomain("num", [{ p25: 1700, median: 2500, p75: 4200 }, { p25: 2400, median: 4100, p75: 7200 }])[0]).toBe(0);
    // a span far from 0: from just under the lowest quartile, 4% to spare
    const [lo, hi] = trendDomain("num", [{ p25: 40, median: 45, p75: 50 }, { p25: 44, median: 48, p75: 52 }]);
    expect(lo).toBeCloseTo(40 - 0.48);
    expect(hi).toBeCloseTo(52 + 0.48);
    // the domain grows to its outer ticks when the data keep at least 80% of the plot; else the ticks sit inside it
    expect(trendTicks("num", [0, 7488])).toEqual({ lo: 0, hi: 8000, step: 2000, ticks: [0, 2000, 4000, 6000, 8000] });
    expect(trendTicks("num", [0, 0.411])).toEqual({ lo: 0, hi: 0.411, step: 0.1, ticks: [0, 0.1, 0.2, 0.3, 0.4] });
    for (const domain of [[0, 7488], [39.52, 52.48], [0, 0.0612], [-0.4, 0.66]]) {
      const t = trendTicks("num", domain);
      expect(t.ticks.length).toBeGreaterThanOrEqual(3);
      expect(t.ticks.length).toBeLessThanOrEqual(5);
      expect(t.lo).toBeLessThanOrEqual(domain[0] + 1e-9);
      expect(t.hi).toBeGreaterThanOrEqual(domain[1] - 1e-9);
    }
  });

  it.skipIf(!real)("never overlaps a label or leaves the chart (every characteristic, four options, six groups, four widths)", { timeout: 60000 }, () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    const charts = { num: 0, bin: 0, grp: 0, band: 0, zero: 0 };
    for (const sub of real.trend.subsets) {
      for (const g of ["all", "adult-romance", "adult-how-to", "chain-stories", "transgender", "celebrity-stories"]) {
        const file = realTrends(sub, g);
        for (const [id, entry] of Object.entries(file.c)) {
          const at = `${sub}/${g} ${id}`;
          if (entry.k === "zero") {
            const halves = trendSplitInputs(real, byId.get(id), entry, file);
            // the split chart at 320, 375 and 768 px screens and on the widest page, side by side from 712 px
            for (const width of [288, 343, 712, 720, 1032]) {
              const split = splitLayout({ width, halves });
              expect(split.side, `${at} ${width}`).toBe(width >= SPLIT_SIDE_FROM);
              expect(splitOverlaps(split), `${at} ${width}`).toEqual([]);
              charts.zero += 1;
            }
            continue;
          }
          const input = trendChartInput(real, byId.get(id), entry, file);
          for (const width of [288, 343, 736, 760]) {
            expect(trendOverlaps(trendLayout({ width, ...input })), `${at} ${width}`).toEqual([]);
            charts[entry.k] += 1;
          }
        }
      }
    }
    expect(charts.num + charts.bin).toBeGreaterThan(10000);
    expect(Math.min(...Object.values(charts))).toBeGreaterThan(100);
  });

  it.skipIf(!real)("gives every number axis three to five ticks, the data at least 80% of its height", () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    for (const sub of real.trend.subsets) {
      for (const g of ["all", "adult-romance", "adult-how-to", "chain-stories", "transgender", "celebrity-stories"]) {
        const file = realTrends(sub, g);
        for (const [id, entry] of Object.entries(file.c)) {
          const input =
            entry.k === "num" ? trendChartInput(real, byId.get(id), entry, file) : entry.k === "zero" ? trendSplitInputs(real, byId.get(id), entry, file)[1].input : null;
          if (!input) continue;
          const [lo, hi] = trendDomain("num", input.cells);
          expect(input.axis.ticks.length, `${sub}/${g} ${id}`).toBeGreaterThanOrEqual(3);
          expect(input.axis.ticks.length, `${sub}/${g} ${id}`).toBeLessThanOrEqual(5);
          expect((hi - lo) / (input.axis.hi - input.axis.lo), `${sub}/${g} ${id}`).toBeGreaterThanOrEqual(0.8 - 1e-9);
        }
      }
    }
  });
});

describe("the chart's numbers (one format per chart)", () => {
  it("takes the decimals from every period's quartiles, up to three significant digits of the largest; percentages whole, with one decimal under 10%", () => {
    const small = trendFormat(WORDS, num([[10, 1.25, 3, 4]], [10, 1, 2, 3], 0.2, 1), true);
    expect(small.value(2.5)).toBe("2.50"); // 1.25 has two decimals: the whole chart prints two
    // a quartile of 0.993 beside a median of 63.6: one decimal, as the largest quartile needs
    const mixed = trendFormat(WORDS, num([[33, 32.6, 63.6, 75.5], [62, 0.993, 48.3, 70]], [95, 5.85, 52.2, 73], 0.2, 1), false);
    expect([63.6, 0.993, 70, 5.85].map(mixed.value)).toEqual(["63.6", "1.0", "70.0", "5.9"]);
    expect(trendFormat(WORDS, num([[10, 1640, 2500, 4220], [10, 1.25, 3, 4]], [10, 1, 2, 3], 0.2, 1), true).value(2810)).toBe("2,810");
    // values the decimals would round away keep two significant digits
    const shift = trendFormat(WORDS, num([[30, -2.87, 0.782, 4.03], [60, -2.32, 0.0006, 4.69]], [90, -2.6, 0.0006, 4.2], 0, 0), false);
    expect([0.782, 0.0006, -2.87].map(shift.value)).toEqual(["0.78", "0.00060", "−2.87"]);
    const share = { ...WORDS, unit: "share (0–1)" };
    const pct = (median) => trendFormat(share, { k: "num", fmt: "percent", q: [[10, median / 2, median, median * 2]], t: null }, true);
    expect(pct(0.13).value(0.13)).toBe("13%");
    expect(pct(0.048).value(0.048)).toBe("4.8%");
    const bin = (s) => trendFormat(NOTE, { k: "bin", q: [[100, s], [100, s / 2]], t: [100, s] }, true);
    expect(bin(0.33).share(0.181)).toBe("18%");
    expect(bin(0.08).share(0.0412)).toBe("4.1%");
  });

  it("says a yes/no characteristic's share in its own words, and titles the axis with the unit of a rate", () => {
    expect(yesPhrase(NOTE)).toBe("with an author’s note");
    expect(yesPhrase({ yes_subject: "First-person stories" })).toBe("first-person");
    expect(yesPhrase({ yes_subject: "Later parts of a series" })).toBe("later parts of a series");
    expect(trendAxisTitle(WORDS, { k: "num" })).toBe("Word count");
    expect(trendAxisTitle({ label: "Sexual language", unit: "per 1,000 words" }, { k: "num", fmt: "num" })).toBe("Sexual language, per 1,000 words");
    expect(trendAxisTitle(NOTE, { k: "bin" })).toBe("Stories with an author’s note, share of stories");
  });

  it("names each period with its numbers", () => {
    const entry = num([[1564, 2340, 4060, 7200]], [10, 1, 2, 3], 0.25, 1);
    const fmt = trendFormat(WORDS, entry, true);
    expect(periodWords({ variable: WORDS, entry, cell: { n: 1564, p25: 2340, median: 4060, p75: 7200 }, fmt, minN: 10 })).toEqual([
      "median 4,060 words",
      "interquartile range 2,340–7,200",
      "1,564 stories",
    ]);
    const yes = { k: "bin", q: [[1564, 0.32]], t: [10, 0.2] };
    expect(periodWords({ variable: NOTE, entry: yes, cell: { n: 1564, share: 0.32 }, fmt: trendFormat(NOTE, yes, true), minN: 10 })).toEqual([
      "32% with an author’s note",
      "1,564 stories",
    ]);
    expect(periodWords({ variable: NOTE, entry: yes, cell: null, fmt: null, minN: 10 })).toEqual(["fewer than 10 stories"]);
  });
});

describe("the heading, the numbers line and the fixed-mix line", () => {
  const heading = (variable, entry, genre = ALL, subset = null) => trendHeading({ variable, entry, genre, subset, file: { ...FILE, g: genre.id } });

  it("says rose, fell, moved later or earlier, changed, or no clear change, from the windows of the file", () => {
    expect(heading(WORDS, num([], [2558], 0.25, 1))).toBe("Story length in words clearly rose from 2000–2009 to 2020 or later");
    expect(heading(WORDS, num([], [2558], -0.32, -1))).toBe("Story length in words clearly fell from 2000–2009 to 2020 or later");
    expect(heading(WORDS, num([], [2558], 0.1, 0))).toBe("No clear change in story length in words from 2000–2009 to 2020 or later");
    expect(heading(NOTE, { k: "bin", r: 0.25, f: 1, t: [99] })).toBe(
      "The share of stories with an author’s note clearly rose from 2000–2009 to 2020 or later",
    );
    expect(heading(NOTE, { k: "bin", r: 0.145, f: 0, t: [99] })).toBe(
      "No clear change in the share of stories with an author’s note from 2000–2009 to 2020 or later",
    );
    const peaks = { id: "pace_sex_peak_position", noun: "where sexual language peaks" };
    expect(heading(peaks, { k: "band", r: 0.3, f: 1, t: [99] })).toBe("Where sexual language peaks clearly moved later from 2000–2009 to 2020 or later");
    expect(heading(peaks, { k: "band", r: -0.3, f: -1, t: [99] })).toBe("Where sexual language peaks clearly moved earlier from 2000–2009 to 2020 or later");
    expect(heading({ noun: "narrative perspective" }, { k: "grp", r: 0.3, f: 1, t: [99] })).toBe(
      "Narrative perspective clearly changed from 2000–2009 to 2020 or later",
    );
    // other windows in the file: other words
    expect(trendHeading({ variable: WORDS, entry: num([], [9], 0.3, 1), genre: ALL, file: { ...FILE, then: [2001, 2008], now: [2019, 2030] } })).toBe(
      "Story length in words clearly rose from 2001–2008 to 2019 or later",
    );
  });

  it("says when a window has too few stories to compare, which window, and the option", () => {
    const transgender = { id: "transgender", name: "Transgender" };
    expect(heading(WORDS, num([], [19, 1, 2, 3], null, 0), transgender)).toBe(
      "Fewer than 30 stories in Transgender were published 2000–2009: too few to compare",
    );
    expect(heading(WORDS, num([], null, null, 0), transgender)).toBe("Fewer than 30 stories in Transgender were published 2000–2009: too few to compare");
    expect(heading(WORDS, num([[12, 1, 2, 3]], [226, 1, 2, 3], null, 0), { id: "chain-stories", name: "Chain Stories" })).toBe(
      "Fewer than 30 stories in Chain Stories were published 2020 or later: too few to compare",
    );
    expect(heading(WORDS, num([], [12, 1, 2, 3], null, 0), ROMANCE, OPTION)).toBe(
      "Fewer than 30 stories in Romance match “Under 2,000 words” and were published 2000–2009: too few to compare",
    );
  });

  it("gives the windows' numbers for numbers, yes/no and mostly-zero characteristics, never for too few", () => {
    // the question above names the genre, so the line doesn't (the trends review)
    const words = (variable, entry, genre = ALL) => {
      const file = { ...FILE, g: genre.id };
      const parts = numbersLine({ variable, entry, file, fmt: trendFormat(variable, entry, genre.id === "all") });
      return parts && parts.map((p) => (typeof p === "string" ? p : `**${p.strong}**`)).join("");
    };
    const length = num([[901, 1640, 2500, 4220], null, null, null, [3343, 2400, 4100, 7200]], [2558, 1680, 2810, 4760], 0.25, 1);
    expect(words(WORDS, length)).toBe("Median **2,810** words in 2000–2009, **4,100** in 2020 or later.");
    const note = { k: "bin", q: [null, null, null, null, [3343, 0.326]], t: [2558, 0.181], r: 0.145, f: 0 };
    expect(words(NOTE, note)).toBe("Stories with an author’s note made up **18%** of stories in 2000–2009, **33%** in 2020 or later.");
    const consent = { id: "rel_consent_per_1k", label: "Consent", noun: "consent language", unit: "per 1,000 words", bins: { type: "ranges" } };
    const zero = { k: "zero", fmt: "num", q: [null, null, null, null, [3346, 700, 0.21, 0.098, 0.196, 0.395]], t: [2561, 233, 0.11, 0.144, 0.229, 0.388], r: 0.092, f: 0 };
    expect(words(consent, zero)).toBe(
      "Stories with any, **11%** in 2000–2009 and **21%** in 2020 or later; among those, median 0.229 and 0.196 per 1,000 words.",
    );
    // a genre works out its share from the two counts
    const zeroRomance = { ...zero, q: [null, null, null, null, [100, 30, 0.1, 0.2, 0.3]], t: [87, 9] };
    expect(words(consent, zeroRomance, ROMANCE)).toBe("Stories with any, **10%** in 2000–2009 and **30%** in 2020 or later.");
    expect(words(WORDS, { ...length, r: null })).toBeNull();
    expect(words({ noun: "narrative perspective", bins: { type: "levels" } }, { k: "grp", q: [], t: [9], r: 0.02, f: 0 })).toBeNull();
  });

  it("says borderline only for All genres, only when the fixed-mix check disagrees, in place of the fixed-mix line (O6)", () => {
    const link = "how\u00a0this\u00a0is\u00a0decided";
    const touch = { k: "num", r: -0.213, f: -1, rm: -0.199, fm: 0 };
    expect(borderlineLine(touch, "all")).toEqual([
      "By the site’s rule it clearly fell, but not once each genre’s share of stories is held fixed (",
      link,
      ").",
    ]);
    expect(borderlineLine({ k: "num", r: 0.196, f: 0, rm: 0.208, fm: 1 }, "all")).toEqual([
      "By the site’s rule the change is not clear, but it clearly rose once each genre’s share of stories is held fixed (",
      link,
      ").",
    ]);
    expect(borderlineLine({ k: "band", r: 0.196, f: 0, rm: 0.208, fm: -1 }, "all")[0]).toMatch(/it clearly moved earlier once each/);
    expect(borderlineLine({ k: "num", r: 0.25, f: 1, rm: 0.246, fm: 1 }, "all")).toBeNull();
    expect(borderlineLine({ k: "num", r: null, f: 0, rm: null, fm: 0 }, "all")).toBeNull();
    expect(borderlineLine({ k: "num", r: -0.3, f: -1 }, "adult-romance")).toBeNull();
    const heading = (variable, entry, genre = ALL) => trendHeading({ variable, entry, genre, subset: { id: "all" }, file: { ...FILE, g: genre.id } });
    const touchWords = { id: "sense_touch_per_1k", label: "Touch words", noun: "touch words", plural: true, unit: "per 1,000 words", bins: { type: "ranges" } };
    expect(heading(touchWords, touch)).toBe("Touch words: a borderline change from 2000–2009 to 2020 or later");
    expect(heading(NOTE, { k: "bin", r: 0.19, f: 0, rm: 0.21, fm: 1 })).toBe(
      "The share of stories with an author’s note: a borderline change from 2000–2009 to 2020 or later",
    );
    // every other heading is unchanged
    expect(heading(touchWords, { ...touch, fm: -1 })).toBe("Touch words clearly fell from 2000–2009 to 2020 or later");
    expect(heading(touchWords, { k: "num", r: -0.213, f: -1 }, ROMANCE)).toBe("Touch words clearly fell from 2000–2009 to 2020 or later");
  });

  it.skipIf(!real)("says borderline exactly where the file's f and fm differ (the real data)", () => {
    const counts = {};
    for (const sub of real.trend.subsets) {
      const file = realTrends(sub, "all");
      const subset = real.subsets.find((x) => x.id === sub);
      counts[sub] = Object.entries(file.c).filter(([id, e]) => {
        const said = trendHeading({ variable: real.variables.find((v) => v.id === id), entry: e, genre: ALL, subset, file }).includes("borderline");
        expect(said, id).toBe(Boolean(borderlineLine(e, "all")));
        return said;
      }).length;
      expect(counts[sub]).toBe(Object.values(file.c).filter((e) => e.r != null && e.f !== e.fm).length);
    }
    expect(counts).toEqual({ all: 2, short: 1, medium: 5, long: 4 }); // the acceptance numbers
    const touch = realTrends("all", "all").c.sense_touch_per_1k;
    expect([touch.r, touch.rm]).toEqual([-0.213, -0.199]);
  });
});

describe("View 1 on the page", () => {
  it("draws the chart with its table, brackets and key, and names each period", async () => {
    await openTrends("#/trends?var=dlg_word_share");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Dialogue share clearly rose from 2000–2009 to 2020 or later");
    const takeaway = document.querySelector(".trend-takeaway").textContent;
    expect(takeaway).toMatch(/^Median \d+% in 2000–2009, \d+% in 2020 or later\.$/);
    const legend = [...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent);
    expect(legend).toEqual([" Median and interquartile range", " The periods compared (how this is decided)"]);
    expect(document.querySelector(".trend-legend .key-range")).toBeTruthy(); // a dot inside a capsule
    expect(document.querySelector(".trend-legend a").getAttribute("href")).toBe("#/methodology/trends");
    const cols = [...document.querySelectorAll(".trend-chart g.col[role='img']")];
    expect(cols).toHaveLength(5);
    expect(cols[0].getAttribute("aria-label")).toMatch(/^2000–04: median \d+%, interquartile range \d+%–\d+%, 42 stories$/);
    expect(document.querySelector(".trend-chart .trend-axis-title").textContent).toBe("Dialogue share");
    const table = document.querySelector(".trend-table");
    expect(table.getAttribute("aria-hidden")).toBe("true");
    // each bracket carries its window's number, the takeaway's (one line each at 720 px)
    const [, then, now] = takeaway.match(/^Median (\d+%) in 2000–2009, (\d+%) in 2020 or later\.$/);
    expect([...table.querySelectorAll(".bracket text")].map((t) => t.textContent)).toEqual([
      `2000–2009 · median ${then}`,
      `2020 or later · median ${now}`,
    ]);
    expect(table.querySelector(".not-compared").textContent).toBe("not compared");
    expect([...document.querySelectorAll(".trend-chart g.col")].map((g) => g.classList.contains("middle"))).toEqual([false, false, true, true, false]);
    expect([...table.querySelectorAll(".col-head")].map((t) => t.textContent)).toEqual(["Median", "Stories"]);
    expect(document.querySelectorAll(".trend-chart .iqr")).toHaveLength(5);
    expect(document.querySelector(".trend-chart .trend-line").getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+){4}$/);
  });

  it("says the question, the heading and the takeaway in the polite live region, again when the genre changes", async () => {
    await openTrends("#/trends?var=dlg_word_share");
    const region = document.querySelector(".trends-page p.visually-hidden[aria-live='polite']");
    await waitFor(() =>
      expect(region.textContent).toMatch(
        /^Across all genres, how has dialogue share changed over time\? Dialogue share clearly rose from 2000–2009 to 2020 or later\. Median \d+% in 2000–2009, \d+% in 2020 or later\.$/,
      ),
    );
    window.location.hash = "#/trends?var=dlg_word_share&genre=fetish";
    await waitFor(() => expect(region.textContent).toMatch(/^In Fetish, how has dialogue share changed over time\? .* Median \d+% in 2000–2009, \d+% in 2020 or later\.$/));
  });

  it("is one tab stop: → ← ↑ ↓, Home and End move between periods and show their details; Escape hides them", async () => {
    await openTrends("#/trends?var=dlg_word_share", { width: 720 });
    const cols = () => [...document.querySelectorAll(".trend-chart g.col")];
    expect(cols().map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    act(() => cols()[0].focus());
    fireEvent.keyDown(cols()[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cols()[1]);
    expect(document.querySelector(".trend-tip strong").textContent).toBe("2005–09");
    fireEvent.keyDown(cols()[1], { key: "End" });
    expect(document.activeElement).toBe(cols()[4]);
    fireEvent.keyDown(cols()[4], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cols()[3]);
    fireEvent.keyDown(cols()[3], { key: "Home" });
    expect(document.activeElement).toBe(cols()[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".trend-tip")).toBeNull();
  });

  it("keeps ← and → for column charts: the other charts' rows don't move on them", () => {
    function Rows() {
      const frame = { current: null };
      const { rowProps } = useRowDetails({ ids: [0, 1, 2], frame, phone: false });
      return (
        <svg>
          {[0, 1, 2].map((i) => (
            <g key={i} data-row={i} {...rowProps(i, i)} />
          ))}
        </svg>
      );
    }
    render(<Rows />);
    const rows = [...document.querySelectorAll("[data-row]")];
    act(() => rows[0].focus());
    fireEvent.keyDown(rows[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
  });

  it("shows a period's details as a line under the chart on phones", async () => {
    await openTrends("#/trends?var=dlg_word_share", { width: 343 });
    const col = document.querySelectorAll(".trend-chart g.col")[4];
    fireEvent.click(col);
    const line = document.querySelector(".trend-line-details");
    expect(line.textContent).toMatch(/^2020–26 median \d+% · interquartile range \d+%–\d+% · 87 stories Tap again to close\.$/);
    expect(document.querySelector(".trend-tip")).toBeNull();
  });

  it("hatches a period under 30 stories, and draws nothing under 10", async () => {
    await openTrends("#/trends?var=dlg_word_share&genre=romance");
    const small = document.querySelectorAll(".trend-chart g.col.small");
    expect(small.length).toBe(4); // Romance's periods: 23, 18, 18, 20 and 41 stories
    expect([...document.querySelectorAll(".trend-table .gn")].map((t) => t.textContent)).toEqual(["23*", "18*", "18*", "20*", "41"]);
    expect([...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent)).toContain(" Fewer than 30 stories (*)");
    window.location.hash = "#/trends?var=dlg_word_share&genre=romance&include=medium";
    await waitFor(() => expect(document.querySelectorAll(".trend-chart .gnone").length).toBeGreaterThan(0));
    const none = [...document.querySelectorAll(".trend-chart g.col")].filter((g) => g.querySelector(".gnone"));
    expect(none.map((g) => g.getAttribute("aria-label"))).toEqual(["2005–09: fewer than 10 stories", "2010–14: fewer than 10 stories"]);
    expect(none.every((g) => !g.querySelector(".iqr, .median"))).toBe(true);
  });

  it("asks about the share for yes/no characteristics", async () => {
    await openTrends("#/trends?var=dlg_has_dialogue");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("The share of stories with dialogue clearly rose from 2000–2009 to 2020 or later");
    expect(document.querySelector(".trend-takeaway").textContent).toMatch(
      /^Stories with dialogue made up \d+% of stories in 2000–2009, \d+% in 2020 or later\.$/,
    );
    expect([...document.querySelectorAll(".trend-legend li")][0].textContent).toBe(" Share of stories");
    expect(document.querySelector(".trend-legend .key-share")).toBeTruthy(); // a dot on a short line
    // no share bar: a dot on the line, as for numbers
    expect(document.querySelectorAll(".trend-chart .share-bar")).toHaveLength(0);
    expect(document.querySelectorAll(".trend-chart .median")).toHaveLength(5);
    expect([...document.querySelectorAll(".trend-table .col-head")][0].textContent).toBe("Share");
    expect([...document.querySelectorAll(".trend-table .bracket text")].map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^2000–2009 · \d+%$/),
      expect.stringMatching(/^2020 or later · \d+%$/),
    ]);
  });

  it("says borderline for All genres when the fixed-mix check disagrees, with its line and link, and never for a genre", async () => {
    const notClear = (body) => {
      Object.assign(body.c.dlg_word_share, { fm: 0, rm: 0.15 });
      return body;
    };
    await openTrends("#/trends?var=dlg_word_share", { change: notClear });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Dialogue share: a borderline change from 2000–2009 to 2020 or later");
    const line = document.querySelector(".trend-borderline");
    expect(line.textContent).toBe(
      "By the site’s rule it clearly rose, but not once each genre’s share of stories is held fixed (how\u00a0this\u00a0is\u00a0decided).",
    );
    expect(within(line).getByRole("link").getAttribute("href")).toBe("#/methodology/trends");
    window.location.hash = "#/trends?var=dlg_word_share&genre=fetish";
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("fetish"));
    await waitFor(() => expect(document.querySelector(".trend-answer[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".trend-borderline")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toMatch(/borderline/);
  });

  it("says when a window has too few stories, and still draws the chart", async () => {
    await openTrends("#/trends?var=dlg_word_share&include=short");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Fewer than 30 stories in All genres match “Under 2,000 words” and were published 2000–2009: too few to compare",
    );
    expect(document.querySelector(".trend-takeaway")).toBeNull();
    expect(document.querySelectorAll(".trend-chart g.col")).toHaveLength(5);
  });

  it("offers all stories, else All genres, when nothing can be drawn, and moves focus to the new heading", async () => {
    const user = await openTrends("#/trends?var=dlg_word_share&genre=romance&include=long");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Fewer than 30 stories in Romance match “5,000 words or more” and were published 2000–2009: too few to compare",
    );
    expect(document.querySelector(".trend-chart")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show all stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=dlg_word_share&genre=romance&include=all"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
    window.location.hash = "#/trends?var=dlg_word_share&genre=tiny";
    const button = await screen.findByRole("button", { name: "Show All genres" });
    await user.click(button);
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=dlg_word_share&genre=all&include=all"));
  });

  it("ends with Download PNG and Compare genres, which opens the Genres page for the characteristic and option", async () => {
    await openTrends("#/trends?var=pov_class&include=medium");
    const compare = screen.getByRole("link", { name: "Compare genres: narrative perspective" });
    expect(compare.textContent).toBe("Compare genres →");
    expect(compare.getAttribute("href")).toBe("#/genres?var=pov_class&include=medium");
    expect(screen.getByRole("button", { name: "Download PNG of this chart" })).toBeTruthy();
  });
});

const POV = {
  id: "pov_class",
  label: "Narrative perspective",
  noun: "narrative perspective",
  unit: "first / second / third",
  bins: { type: "levels", labels: ["First", "Second", "Third"] },
};

describe("named groups and bands: 100% columns", () => {
  it("colors the groups as the Genres page does: named groups by their shares in 2000–2009, the largest darkest; bands light to dark", () => {
    const cells = [{ n: 100, shares: [0.2, 0.5, 0.3] }, null, { n: 300, shares: [0.6, 0.1, 0.3] }];
    expect(trendMixColors("grp", cells, 3, [0.1, 0.6, 0.3]).map((c) => c.cls)).toEqual(["pal-group-2", "pal-group-0", "pal-group-1"]);
    // 2000–2009 with too few stories: over the periods, weighted by their stories (0.5, 0.2, 0.3)
    expect(trendMixColors("grp", cells, 3).map((c) => c.cls)).toEqual(["pal-group-0", "pal-group-2", "pal-group-1"]);
    expect(trendMixColors("band", cells, 3).map((c) => c.cls)).toEqual(["pal-band-0", "pal-band-1", "pal-band-2"]);
  });

  it("stacks the groups from the bottom up, and prints a share only where its segment is 16 px tall and has an ink", () => {
    const entry = { k: "grp", q: FILE.periods.map(() => [100, 0.6, 0.05, 0.35]), t: [100, 0.6, 0.05, 0.35], r: 0, f: 0 };
    const layout = trendLayout({ width: 736, ...trendChartInput(fixtureMeta, POV, entry, FILE) });
    const segs = mixSegments(layout, layout.columns[0], [0.6, 0.05, 0.35], ["white", "dark", ""], formatPercent);
    expect(segs[0].y + segs[0].height).toBeCloseTo(layout.bottom);
    expect(segs[1].y + segs[1].height).toBeCloseTo(segs[0].y);
    expect(segs[2].y).toBeCloseTo(layout.top);
    expect(segs.map((x) => x.label?.text ?? null)).toEqual(["60%", null, null]); // 5% is 12.5 px tall; the third has no ink
    expect(layout.heads.map((h) => h.text)).toEqual(["Stories"]); // the shares are in the columns
  });

  it("draws one 100% column per period, the groups' key above it, and names each period with every group's share", async () => {
    await openTrends("#/trends?var=pov_class");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("No clear change in narrative perspective from 2000–2009 to 2020 or later");
    expect(document.querySelector(".trend-takeaway")).toBeNull(); // no numbers line: the shares are in the chart
    const labels = fixtureMeta.variables.find((v) => v.id === "pov_class").bins.labels;
    // the three groups under 3% in every period are one "Other" (the test data has no story in them)
    expect([...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent.trim())).toEqual([
      "First person (I)",
      "Third person",
      "Other (first person plural (we), second person (you), mixed)",
      "The periods compared (how this is decided)",
    ]);
    const cols = [...document.querySelectorAll(".trend-mix g.col[role='img']")];
    expect(cols).toHaveLength(5);
    expect(cols[0].getAttribute("aria-label")).toBe(
      "2000–04: First person (I) 69%, First person plural (we) 0%, Second person (you) 0%, Third person 31%, Mixed 0%, 42 stories",
    );
    const pov = fixtureFile("trends/all/all.json").c.pov_class;
    const colors = trendMixColors("grp", trendCells(pov, true, 30), labels.length, pov.t.slice(1));
    const segments = [...cols[0].querySelectorAll(".segment")];
    expect(segments.map((r) => r.getAttribute("class"))).toEqual([`segment ${colors[0].cls}`, `segment ${colors[3].cls}`]); // empty groups draw nothing
    expect([...cols[0].querySelectorAll(".seglab")].map((t) => t.textContent)).toEqual(["69%", "31%"]);
    expect([...document.querySelectorAll(".trend-table .col-head")].map((t) => t.textContent)).toEqual(["Stories"]);
    expect(document.querySelector(".trend-table .gval")).toBeNull();
    expect(document.querySelectorAll(".trend-legend .key-swatch")).toHaveLength(3);
    expect(document.querySelector(".trend-legend .key-swatch.pal-other")).toBeTruthy();
    // named groups and bands keep their colors between the windows, and get only "not compared"
    expect([...document.querySelectorAll(".trend-table .bracket text")].map((t) => t.textContent)).toEqual(["2000–2009", "2020 or later"]);
    expect(document.querySelector(".trend-table .not-compared")).toBeTruthy();
  });

  it("merges two or more named groups under 3% in every period drawn into “Other”, never one alone, never bands", () => {
    const labels = ["First person (I)", "First person plural (we)", "Second person (you)", "Third person", "Mixed"];
    const cell = (shares, n = 100) => ({ n, shares });
    const cells = [cell([0.57, 0.004, 0.02, 0.39, 0.016]), null, cell([0.55, 0.005, 0.025, 0.4, 0.02]), cell([0.54, 0.006, 0.01, 0.44, 0.004])];
    const groups = trendMixGroups("grp", cells, labels, [0.57, 0.004, 0.02, 0.39, 0.016]);
    expect(groups.map((g) => g.label)).toEqual(["First person (I)", "Third person", "Other (first person plural (we), second person (you), mixed)"]);
    expect(groups[2]).toMatchObject({ cls: "pal-other", ink: "dark", members: [1, 2, 4] });
    // one group under 3% stays itself
    const one = trendMixGroups("grp", [cell([0.6, 0.02, 0.38])], ["A", "B", "C"]);
    expect(one.map((g) => g.label)).toEqual(["A", "B", "C"]);
    // a group under 3% in one period but not another stays itself
    const mixed = trendMixGroups("grp", [cell([0.9, 0.02, 0.08]), cell([0.9, 0.05, 0.01]), cell([0.9, 0.02, 0.01])], ["A", "B", "C"]);
    expect(mixed.map((g) => g.label)).toEqual(["A", "B", "C"]);
    expect(trendMixGroups("band", cells, labels).map((g) => g.label)).toEqual(labels);
  });

  it("colors each group as View 2's rows do", async () => {
    const user = await openTrends("#/trends?var=pov_class");
    const swatch = (li) => li.querySelector(".key-swatch, .profile-swatch").className.match(/pal-\w+-?\d*/)[0];
    const viewOne = Object.fromEntries([...document.querySelectorAll(".trend-legend li")].filter((li) => li.querySelector(".key-swatch")).map((li) => [li.textContent.trim(), swatch(li)]));
    window.location.hash = "#/trends?view=changes";
    await waitFor(() => expect(document.querySelector(".trend-changes")).toBeTruthy());
    await user.click([...document.querySelectorAll(".profile-topic summary")].find((x) => x.textContent.startsWith("Narration")));
    await waitFor(() => expect(document.querySelector(".profile-key")).toBeTruthy());
    const viewTwo = Object.fromEntries([...document.querySelectorAll(".profile-key .profile-key-item")].map((li) => [li.textContent.trim(), swatch(li)]));
    // the groups View 1 draws on their own have View 2's colors ("Other" is View 1's)
    for (const [label, cls] of Object.entries(viewOne)) if (cls !== "pal-other") expect(viewTwo[label], label).toBe(cls);
    expect(Object.keys(viewOne)).toHaveLength(3);
  });

  it("hatches a period under 30 stories", async () => {
    await openTrends("#/trends?var=pov_class&genre=romance");
    expect(document.querySelectorAll(".trend-mix .small-over")).toHaveLength(4); // 23, 18, 18 and 20 stories
    expect([...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent.trim())).toContain("Fewer than 30 stories (*)");
  });

  it("draws ordered bands from light to dark, the first at the bottom, with the ink each color takes", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 736, height: 0, top: 0, left: 0, right: 736, bottom: 0 });
    const labels = ["1st fifth", "2nd fifth", "Middle", "4th fifth", "Last fifth"];
    const band = { id: "pace_sex_peak_position", label: "Where sexual language peaks", noun: "where sexual language peaks", unit: "position", bins: { type: "levels", labels, ordered: true } };
    const entry = { k: "band", q: FILE.periods.map(() => [100, 0.1, 0.1, 0.2, 0.3, 0.3]), t: [200, 0.1, 0.1, 0.2, 0.3, 0.3], r: 0.1, f: 0 };
    render(<TrendMix meta={fixtureMeta} variable={band} entry={entry} file={FILE} title="A band" />);
    expect(document.querySelector(".trend-mix").classList.contains("bands-5")).toBe(true);
    const col = document.querySelectorAll(".trend-mix g.col")[0];
    const segs = [...col.querySelectorAll(".segment")];
    expect(segs.map((r) => r.getAttribute("class"))).toEqual(labels.map((_, b) => `segment pal-band-${b}`));
    expect(Number(segs[0].getAttribute("y"))).toBeGreaterThan(Number(segs[4].getAttribute("y")));
    expect([...col.querySelectorAll(".seglab")].map((t) => t.getAttribute("class").replace("seglab ", ""))).toEqual([
      "seg-ink-dark",
      "seg-ink-dark",
      "seg-ink-dark",
      "seg-ink-white",
      "seg-ink-white",
    ]);
    render(<TrendLegend kind="band" anySmall={false} minStories={30} groups={labels.map((label, b) => ({ label, cls: `pal-band-${b}` }))} />);
    expect(document.querySelector(".trend-legend").classList.contains("bands-5")).toBe(true);
  });
});

describe("mostly zero: the split chart", () => {
  it("draws both halves in one svg, side by side from 712 px, and names each period with both, in the Genres page's words", async () => {
    await openTrends("#/trends?var=emo_anger_per_1k", { width: 1032 });
    const chart = document.querySelector(".trend-split");
    expect(chart.classList.contains("side")).toBe(true);
    expect(chart.querySelectorAll("svg")).toHaveLength(1);
    expect([...chart.querySelectorAll(".half-title")].map((t) => t.textContent)).toEqual(["Stories with any", "Among stories with any"]);
    expect([...chart.querySelectorAll(".half-axis-title")].map((t) => t.textContent)).toEqual(["Share of stories", "per 1,000 words"]);
    const cols = [...chart.querySelectorAll("g.col[role='img']")];
    expect(cols).toHaveLength(5);
    expect(cols[0].getAttribute("aria-label")).toMatch(
      /^2000–04: 47% with any, among those, median [\d.]+ per 1,000 words, interquartile range [\d.]+–[\d.]+, 42 stories$/,
    );
    const [any, among] = chart.querySelectorAll(".trend-table");
    expect([...any.querySelectorAll(".col-head")].map((t) => t.textContent)).toEqual(["Share", "Stories"]);
    expect([...among.querySelectorAll(".col-head")].map((t) => t.textContent)).toEqual(["Median", "Stories"]);
    expect(any.querySelector(".gn").textContent).toBe("42");
    expect(among.querySelector(".gn").textContent).toBe("22*"); // the stories with any, hatched under 30
    expect(cols[0].querySelectorAll(".half")[1].classList.contains("small")).toBe(true);
    // the split chart's two dots differ in the key: a dot on a line, a dot inside a capsule
    expect([...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent.trim())).toEqual([
      "Share of stories",
      "Median and interquartile range",
      "Fewer than 30 stories (*)",
      "The periods compared (how this is decided)",
    ]);
    expect(document.querySelectorAll(".trend-legend li:nth-child(3) .key")).toHaveLength(2); // a hollow dot, a hatched capsule
    // each half's brackets carry its numbers: the share with any, the median among those
    expect([...any.querySelectorAll(".bracket text")].map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^2000–2009 · \d+% with any$/),
      expect.stringMatching(/^2020 or later · \d+% with any$/),
    ]);
    expect([...among.querySelectorAll(".bracket text")].map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^2000–2009 · median [\d.]+$/),
      expect.stringMatching(/^2020 or later · median [\d.]+$/),
    ]);
    expect(chart.querySelectorAll(".not-compared")).toHaveLength(2);
    expect(document.querySelector(".trend-takeaway").textContent).toMatch(
      /^Stories with any, \d+% in 2000–2009 and \d+% in 2020 or later; among those, median [\d.]+ and [\d.]+ per 1,000 words\.$/,
    );
  });

  it("stacks the halves below 712 px", async () => {
    await openTrends("#/trends?var=emo_anger_per_1k", { width: 600 });
    const chart = document.querySelector(".trend-split");
    expect(chart.classList.contains("side")).toBe(false);
    const halves = [...chart.querySelectorAll("svg > g[transform]")].slice(0, 2).map((g) => g.getAttribute("transform"));
    expect(halves[0]).toBe("translate(0,0)");
    expect(halves[1]).toMatch(/^translate\(0,\d+/);
  });

  it("lights a period in both halves and puts its card beside the column the pointer is on", async () => {
    await openTrends("#/trends?var=emo_anger_per_1k", { width: 1032 });
    const row = document.querySelectorAll(".trend-split g.col")[3];
    fireEvent.click(row);
    expect(row.classList.contains("active")).toBe(true);
    expect(document.querySelector(".trend-tip").style.left).not.toBe(""); // the first half's 2015–19: the card to its right
    fireEvent.pointerEnter(row.querySelectorAll(".half")[1]);
    expect(document.querySelector(".trend-tip").style.right).not.toBe(""); // the second half's: to its left, in that half
    expect(document.querySelector(".trend-tip strong").textContent).toBe("2015–19");
  });

  it("gives the PNG both halves", async () => {
    await openTrends("#/trends?var=emo_anger_per_1k", { width: 1032 });
    const spec = trendsImage(
      {
        variable: fixtureMeta.variables.find((v) => v.id === "emo_anger_per_1k"),
        genre: fixtureMeta.genres.find((g) => g.id === "all"),
        heading: "Heading",
        subset: fixtureMeta.subsets.find((x) => x.id === "all"),
        state: { v: "emo_anger_per_1k", genre: "all", sub: "all" },
      },
      document.querySelector(".trend-answer"),
    );
    const svgs = spec.chart.querySelectorAll(".chart-frame svg");
    expect(svgs).toHaveLength(1);
    expect([...svgs[0].querySelectorAll(".half-title")]).toHaveLength(2);
  });
});

describe("the PNG", () => {
  it("has the question as its title, the heading and the genre and option as its subtitle, and the key without its link", async () => {
    await openTrends("#/trends?var=dlg_word_share&genre=fetish&include=medium");
    const panel = document.querySelector(".trend-answer");
    const meta = fixtureMeta;
    const spec = trendsImage(
      {
        variable: meta.variables.find((v) => v.id === "dlg_word_share"),
        genre: meta.genres.find((g) => g.id === "fetish"),
        heading: "Heading",
        subset: meta.subsets.find((s) => s.id === "medium"),
        state: { v: "dlg_word_share", genre: "fetish", sub: "medium" },
      },
      panel,
    );
    expect(spec.title).toEqual(["In Fetish, how has dialogue share changed over time?"]);
    expect(spec.subtitle).toEqual(["Heading", "Fetish · 2,000–5,000 words"]);
    expect(spec.fileName).toBe("trends-dlg_word_share-fetish-medium.png");
    expect(spec.chart.classList.contains("trend-chart")).toBe(true);
    expect(keyItems(spec.legend).map((k) => k.text)).toContain("The periods compared");
    expect(trendsFileName({ v: "Story_Words", genre: "All", sub: "All" })).toBe("trends-story_words-all-all.png");
  });

  it("puts a period's card beside its column, not centered over it as the explorer's are", () => {
    expect(css).toMatch(/\.range-chart \.chart-tip\.trend-tip \{\s*transform: none;/);
  });

  it("gives the key's link a 44 px target, never broken, and lets a tap on the table reach its period's column", () => {
    expect(css).toMatch(/\.trend-legend a,\s*\.trend-borderline a \{\s*position: relative;\s*white-space: nowrap;/);
    expect(css).toMatch(/\.trend-legend a::after,\s*\.trend-borderline a::after \{[^}]*height: max\(100%, var\(--target\)\);/);
    expect(css).toMatch(/\.trend-chart \.trend-table \{\s*pointer-events: none;/);
  });

  it("never anchors the scroll position on the question's words, which another genre or characteristic re-wraps", () => {
    expect(css).toMatch(/\.trends-page \.question \{\s*overflow-anchor: none;/);
  });

  it("draws the key in forced colors as the explorer's is drawn", () => {
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"));
    expect(forced).toMatch(/\.trend-legend \.key \{\s*forced-color-adjust: none;/);
    expect(forced).toMatch(/\.trend-legend \.key-share \{\s*background:\s*radial-gradient\(circle at 50% 50%, Highlight/);
    expect(forced).toMatch(/\.trend-legend \.key-range \{\s*background: radial-gradient\(circle at 50% 50%, Highlight/);
    expect(forced).toMatch(/\.trend-legend \.key-small-dot \{\s*background: Canvas;\s*border-color: Highlight;/);
    expect(forced).toMatch(/\.trend-legend \.key-small \{\s*background: Canvas;\s*border: 1px dashed CanvasText;/);
  });

  it("keeps the trends chart's look in forced colors: the gray periods and the line in GrayText", () => {
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"));
    expect(forced).toMatch(/\.trend-chart \.bracket path \{\s*stroke: CanvasText;/);
    expect(forced).toMatch(/\.trend-chart \.bracket text,\s*\.trend-chart \.not-compared \{\s*fill: CanvasText;/);
    expect(forced).toMatch(/\.trend-chart \.trend-line \{\s*stroke: GrayText;/);
    expect(forced).toMatch(/\.trend-chart \.row\.middle \.median \{\s*fill: GrayText;/);
  });
});

describe("the page's own words", () => {
  it("says the fixture's characteristic that changes on purpose clearly rose, with the windows' numbers", async () => {
    await openTrends("#/trends?var=dlg_word_share&genre=fetish");
    expect(within(document.querySelector(".trend-answer")).getByRole("heading", { level: 2 }).textContent).toBe(
      "Dialogue share clearly rose from 2000–2009 to 2020 or later",
    );
  });
});
