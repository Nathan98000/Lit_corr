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
import { trendsImage } from "../components/TrendAnswer.jsx";
import useRowDetails from "../components/useRowDetails.js";
import { keyItems } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import { TWO_LINES_UNDER, periodLabel, periodLines, trendDomain, trendLayout, trendOverlaps, trendTicks } from "../lib/trendLayout.js";
import {
  mixFixedLine,
  numbersLine,
  periodWords,
  trendAxisTitle,
  trendChartInput,
  trendFormat,
  trendHeading,
  trendsFileName,
  yesPhrase,
} from "../lib/trends.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

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
    for (const domain of [[0, 7488], [39.52, 52.48], [0, 0.0612], [-0.4, 0.66]]) {
      const t = trendTicks("num", domain);
      expect(t.ticks.length).toBeGreaterThanOrEqual(3);
      expect(t.ticks.length).toBeLessThanOrEqual(5);
      expect(t.lo).toBeLessThanOrEqual(domain[0] + 1e-9);
      expect(t.hi).toBeGreaterThanOrEqual(domain[1] - 1e-9);
    }
  });

  it.skipIf(!real)("never overlaps a label or leaves the chart (every number and yes/no characteristic, four options, six groups, four widths)", { timeout: 60000 }, () => {
    const byId = new Map(real.variables.map((v) => [v.id, v]));
    let charts = 0;
    for (const sub of real.trend.subsets) {
      for (const g of ["all", "adult-romance", "adult-how-to", "chain-stories", "transgender", "celebrity-stories"]) {
        const file = realTrends(sub, g);
        for (const [id, entry] of Object.entries(file.c)) {
          if (entry.k !== "num" && entry.k !== "bin") continue;
          const input = trendChartInput(real, byId.get(id), entry, file);
          for (const width of [288, 343, 736, 760]) {
            expect(trendOverlaps(trendLayout({ width, ...input })), `${sub}/${g} ${id} ${width}`).toEqual([]);
            charts += 1;
          }
        }
      }
    }
    expect(charts).toBeGreaterThan(10000);
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
    const words = (variable, entry, genre = ALL) => {
      const file = { ...FILE, g: genre.id };
      const parts = numbersLine({ variable, entry, genre, file, fmt: trendFormat(variable, entry, genre.id === "all") });
      return parts && parts.map((p) => (typeof p === "string" ? p : `**${p.strong}**`)).join("");
    };
    const length = num([[901, 1640, 2500, 4220], null, null, null, [3343, 2400, 4100, 7200]], [2558, 1680, 2810, 4760], 0.25, 1);
    expect(words(WORDS, length)).toBe("All genres: median **2,810** words in 2000–2009, **4,100** in 2020 or later.");
    const note = { k: "bin", q: [null, null, null, null, [3343, 0.326]], t: [2558, 0.181], r: 0.145, f: 0 };
    expect(words(NOTE, note)).toBe("All genres: stories with an author’s note made up **18%** of stories in 2000–2009, **33%** in 2020 or later.");
    const consent = { id: "rel_consent_per_1k", label: "Consent", noun: "consent language", unit: "per 1,000 words", bins: { type: "ranges" } };
    const zero = { k: "zero", fmt: "num", q: [null, null, null, null, [3346, 700, 0.21, 0.098, 0.196, 0.395]], t: [2561, 233, 0.11, 0.144, 0.229, 0.388], r: 0.092, f: 0 };
    expect(words(consent, zero)).toBe(
      "All genres: stories with any, **11%** in 2000–2009 and **21%** in 2020 or later; among those, median 0.229 and 0.196 per 1,000 words.",
    );
    // a genre works out its share from the two counts
    const zeroRomance = { ...zero, q: [null, null, null, null, [100, 30, 0.1, 0.2, 0.3]], t: [87, 9] };
    expect(words(consent, zeroRomance, ROMANCE)).toBe("Romance: stories with any, **10%** in 2000–2009 and **30%** in 2020 or later.");
    expect(words(WORDS, { ...length, r: null })).toBeNull();
    expect(words({ noun: "narrative perspective", bins: { type: "levels" } }, { k: "grp", q: [], t: [9], r: 0.02, f: 0 })).toBeNull();
  });

  it("says the fixed-mix check only for All genres, and only when it gives another verdict", () => {
    expect(mixFixedLine({ k: "num", r: -0.213, f: -1, rm: -0.199, fm: 0 }, "all")).toBe(
      "Holding each genre’s share of stories fixed, the change is not clear.",
    );
    expect(mixFixedLine({ k: "num", r: 0.196, f: 0, rm: 0.208, fm: 1 }, "all")).toBe("Holding each genre’s share of stories fixed, it clearly rose.");
    expect(mixFixedLine({ k: "band", r: 0.196, f: 0, rm: 0.208, fm: -1 }, "all")).toBe("Holding each genre’s share of stories fixed, it clearly moved earlier.");
    expect(mixFixedLine({ k: "num", r: 0.25, f: 1, rm: 0.246, fm: 1 }, "all")).toBeNull();
    expect(mixFixedLine({ k: "num", r: null, f: 0, rm: null, fm: 0 }, "all")).toBeNull();
    expect(mixFixedLine({ k: "num", r: -0.3, f: -1 }, "adult-romance")).toBeNull();
  });

  it.skipIf(!real)("shows the mix line exactly where the file's f and fm differ (the real data)", () => {
    const counts = {};
    for (const sub of real.trend.subsets) {
      const file = realTrends(sub, "all");
      counts[sub] = Object.values(file.c).filter((e) => mixFixedLine(e, "all")).length;
      expect(counts[sub]).toBe(Object.values(file.c).filter((e) => e.r != null && e.f !== e.fm).length);
    }
    expect(counts).toEqual({ all: 2, short: 1, medium: 5, long: 4 }); // the acceptance numbers (§1.7)
  });
});

describe("View 1 on the page", () => {
  it("draws the chart with its table, brackets and key, and names each period", async () => {
    await openTrends("#/trends?var=dlg_word_share");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Dialogue share clearly rose from 2000–2009 to 2020 or later");
    const takeaway = document.querySelector(".trend-takeaway").textContent;
    expect(takeaway).toMatch(/^All genres: median \d+% in 2000–2009, \d+% in 2020 or later\.$/);
    const legend = [...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent);
    expect(legend).toEqual([" Median", " Interquartile range", " The periods compared (how this is decided)"]);
    expect(document.querySelector(".trend-legend a").getAttribute("href")).toBe("#/methodology/trends");
    const cols = [...document.querySelectorAll(".trend-chart g.col[role='img']")];
    expect(cols).toHaveLength(5);
    expect(cols[0].getAttribute("aria-label")).toMatch(/^2000–04: median \d+%, interquartile range \d+%–\d+%, 42 stories$/);
    expect(document.querySelector(".trend-chart .trend-axis-title").textContent).toBe("Dialogue share");
    const table = document.querySelector(".trend-table");
    expect(table.getAttribute("aria-hidden")).toBe("true");
    expect([...table.querySelectorAll(".bracket text")].map((t) => t.textContent)).toEqual(["2000–2009", "2020 or later"]);
    expect([...table.querySelectorAll(".col-head")].map((t) => t.textContent)).toEqual(["Median", "Stories"]);
    expect(document.querySelectorAll(".trend-chart .iqr")).toHaveLength(5);
    expect(document.querySelector(".trend-chart .trend-line").getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+){4}$/);
  });

  it("says the heading and the takeaway in the polite live region, again when the genre changes", async () => {
    await openTrends("#/trends?var=dlg_word_share");
    const region = document.querySelector(".trends-page p.visually-hidden[aria-live='polite']");
    await waitFor(() =>
      expect(region.textContent).toMatch(/^Dialogue share clearly rose from 2000–2009 to 2020 or later\. All genres: median \d+% in 2000–2009, \d+% in 2020 or later\.$/),
    );
    window.location.hash = "#/trends?var=dlg_word_share&genre=fetish";
    await waitFor(() => expect(region.textContent).toMatch(/ Fetish: median \d+% in 2000–2009, \d+% in 2020 or later\.$/));
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
    expect([...document.querySelectorAll(".trend-legend li")].map((li) => li.textContent)).toContain(" Fewer than 30 stories");
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
      /^All genres: stories with dialogue made up \d+% of stories in 2000–2009, \d+% in 2020 or later\.$/,
    );
    expect([...document.querySelectorAll(".trend-legend li")][0].textContent).toBe(" Share of stories");
    expect(document.querySelectorAll(".trend-chart .share-bar")).toHaveLength(5);
    expect([...document.querySelectorAll(".trend-table .col-head")][0].textContent).toBe("Share");
  });

  it("adds the fixed-mix line for All genres when it gives another verdict, and never for a genre", async () => {
    const notClear = (body) => {
      Object.assign(body.c.dlg_word_share, { fm: 0, rm: 0.15 });
      return body;
    };
    await openTrends("#/trends?var=dlg_word_share", { change: notClear });
    expect(document.querySelector(".trend-mix").textContent).toBe("Holding each genre’s share of stories fixed, the change is not clear.");
    window.location.hash = "#/trends?var=dlg_word_share&genre=fetish";
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("fetish"));
    await waitFor(() => expect(document.querySelector(".trend-answer[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".trend-mix")).toBeNull();
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

  it("keeps the trends chart's look in forced colors", () => {
    expect(css).toMatch(/@media \(forced-colors: active\) \{[^@]*\.trend-chart \.trend-line,\s*\.trend-chart \.bracket path \{\s*stroke: CanvasText;/);
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
