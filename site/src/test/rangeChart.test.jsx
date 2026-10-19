import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import RangeChart from "../components/RangeChart.jsx";
import { cellStats, groupRows } from "../lib/data.js";
import { overlaps, outside, rangeLayout, textWidth } from "../lib/rangeLayout.js";
import { answerHeading, chartSummary, oneGroupNote, segmentsText, takeawaySegments } from "../lib/wording.js";
import { fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const readReal = (v, sub = "all") => JSON.parse(readFileSync(path.join(REAL, "v", v, `${sub}.json`), "utf8"));

// phone widths minus the page's 16 px side padding
const PHONE_WIDTHS = [320 - 32, 375 - 32];

function layoutsFor(meta, data, genres, widths) {
  const out = [];
  for (const g of genres) {
    const gd = data.g[g];
    if (!gd) continue;
    meta.metrics.forEach((metric, k) => {
      const rows = groupRows(meta.variables.find((v) => v.id === data.v), gd, k);
      const overall = cellStats(gd.o, k);
      if (!rows.some((r) => r.stats && !r.stats.suppressed)) return;
      for (const width of widths) {
        out.push({ g, metric: metric.id, width, layout: rangeLayout({ rows, overall, format: metric.format, width }) });
      }
    });
  }
  return out;
}

describe("the chart layout", () => {
  it.skipIf(!real)("never overlaps or leaves the screen on phones, for every characteristic", () => {
    const problems = [];
    for (const variable of real.variables) {
      const data = readReal(variable.id);
      for (const { g, metric, width, layout } of layoutsFor(
        real,
        data,
        ["all", "adult-romance", "adult-how-to", "taboo-sex-stories"],
        PHONE_WIDTHS,
      )) {
        const hits = overlaps(layout);
        const out = outside(layout);
        if (hits.length || out.length) problems.push(`${variable.id} ${g} ${metric} @${width}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it.skipIf(!real)("also holds on wider screens and for the filtered views with large numbers", () => {
    const problems = [];
    for (const [v, sub] of [
      ["pace_descriptive_shift", "y2000"],
      ["pub_month", "all"],
      ["author_stories_count", "all"],
      ["series_is_later_part", "all"],
      ["title_has_chapter_marker", "long"],
    ]) {
      const data = readReal(v, sub);
      for (const { g, metric, width, layout } of layoutsFor(
        real,
        data,
        Object.keys(data.g),
        [288, 343, 600, 720, 1000],
      )) {
        if (overlaps(layout).length || outside(layout).length) problems.push(`${v}/${sub} ${g} ${metric} @${width}`);
      }
    }
    expect(problems).toEqual([]);
  });

  const rows = (values) =>
    values.map((m, index) => ({
      index,
      label: `Group ${index + 1}`,
      stats: m == null ? null : { n: 100, median: m, p25: m * 0.7, p75: m * 1.3, mean: m * 1.1 },
    }));

  it("uses 4 ticks on phones (never more than 5) and 6 on wider screens", () => {
    const r = rows([12000, 40000, 61000, 800000]);
    const overall = { median: 50000 };
    const phone = rangeLayout({ rows: r, overall, format: "count", width: 343 });
    const wide = rangeLayout({ rows: r, overall, format: "count", width: 900 });
    expect(phone.ticks.length).toBeLessThanOrEqual(5);
    expect(phone.ticks.length).toBeGreaterThanOrEqual(3);
    expect(wide.ticks.length).toBeGreaterThan(phone.ticks.length);
    expect(wide.ticks.length).toBeLessThanOrEqual(8);
  });

  it("writes large values compactly on phones and keeps the first tick label on screen", () => {
    const r = rows([12000, 40000, 61000, 800000]).map((x) => ({ ...x, label: "A long group label" }));
    const phone = rangeLayout({ rows: r, overall: { median: 50000 }, format: "count", width: 288 });
    expect(phone.mode).toBe("stacked");
    expect(phone.ticks.slice(1).every((t) => /^[\d.]+[kM]$/.test(t.text))).toBe(true);
    expect(phone.left).toBeGreaterThanOrEqual(textWidth(phone.ticks[0].text, 12) / 2);
    const wide = rangeLayout({ rows: r, overall: { median: 50000 }, format: "count", width: 900 });
    expect(wide.ticks.slice(1).every((t) => /^\d{1,3}(,\d{3})+$/.test(t.text))).toBe(true);
  });

  it("puts short labels in a narrow column on phones and long ones above the bars", () => {
    const months = rows([1, 2, 3]).map((x, i) => ({ ...x, label: ["Jan", "Feb", "Mar"][i] }));
    const inline = rangeLayout({ rows: months, overall: null, format: "rate", width: 343 });
    expect(inline).toMatchObject({ mode: "inline", rowH: 44 });
    // the column holds each label, level with its value; no row prints its stories (the owner, 2026-10-19)
    expect(inline.rows.map((r) => r.nText)).toEqual([undefined, undefined, undefined]);
    expect(inline.labelW).toBe(64 + 4);
    expect(inline.rows.every((r) => r.boxes.every((b) => b.kind !== "label" || b.x1 <= inline.labelW))).toBe(true);
    expect(inline.rows.every((r) => r.labelPos.y === r.cy + 5)).toBe(true);
    const long = rows([1, 2]).map((x, i) => ({ ...x, label: ["First part or stand-alone", "Later part"][i] }));
    expect(rangeLayout({ rows: long, overall: null, format: "rate", width: 343 })).toMatchObject({
      mode: "stacked",
      rowH: 56,
    });
    const side = rangeLayout({ rows: long, overall: null, format: "rate", width: 1000 });
    expect(side.mode).toBe("side");
    expect(side.labelW).toBeGreaterThanOrEqual(110);
    expect(side.labelW).toBeLessThanOrEqual(220);
  });

  it("starts counts and rates at zero and zooms ratings", () => {
    expect(rangeLayout({ rows: rows([10, 20]), overall: null, format: "count", width: 600 }).lo).toBe(0);
    const rating = rangeLayout({ rows: rows([4.2, 4.6]), overall: null, format: "rating", width: 600 });
    expect(rating.lo).toBeGreaterThan(2);
  });
});

describe("answer heading, takeaway and summary", () => {
  const v = (id) => fixtureMeta.variables.find((x) => x.id === id);
  const fav = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const all = fixtureMeta.genres[0];
  const base = { metric: fav, genre: all };

  it("covers every case", () => {
    expect(answerHeading({ ...base, variable: v("dlg_word_share"), direction: 1, effect: 0.3, shown: 5 })).toBe(
      "Stories with more dialogue tend to get more favorites per 1,000 views",
    );
    expect(answerHeading({ ...base, variable: v("dlg_word_share"), direction: 0, effect: 0.05, shown: 5 })).toBe(
      "No clear pattern",
    );
    expect(answerHeading({ ...base, variable: v("dlg_has_dialogue"), direction: 0, effect: null, shown: 2 })).toBe(
      "Too few stories to judge a pattern",
    );
    expect(answerHeading({ ...base, variable: v("pov_class"), direction: 0, effect: null, shown: 2 })).toBe(
      "Each group on its own",
    );
    expect(answerHeading({ ...base, variable: v("dlg_word_share"), direction: 1, effect: 0.3, shown: 1 })).toBe(
      "Too few stories to compare here",
    );
  });

  const r = (label, median) => ({ label, stats: median == null ? null : { n: 40, median } });
  const text = (x) => x.toFixed(2);

  it("names the end groups, and says so when one is hidden", () => {
    const variable = v("dlg_word_share");
    expect(segmentsText(takeawaySegments({ variable, rows: [r("Low", 0.28), r("Mid", 0.5), r("High", 0.89)], valueText: text }))).toBe(
      "Median: 0.28 for “Low”, 0.89 for “High”.",
    );
    expect(segmentsText(takeawaySegments({ variable, rows: [r("Low", null), r("Mid", 0.5), r("High", 0.89)], valueText: text }))).toBe(
      "Median: 0.89 for “High”; “Low” has too few stories.",
    );
    const binary = v("dlg_has_dialogue");
    expect(segmentsText(takeawaySegments({ variable: binary, rows: [r("Has dialogue", 0.43), r("No dialogue", 0.56)], valueText: text }))).toBe(
      "Median: 0.43 for stories with dialogue, 0.56 for stories without dialogue.",
    );
    expect(takeawaySegments({ variable: v("pov_class"), rows: [r("A", 1), r("B", 2)], valueText: text })).toBeNull();
  });

  it("describes the chart in one sentence and names the only group", () => {
    expect(chartSummary({ rows: [r("Under 2,000", 0.28), r("7,000+", 0.89)], valueText: text, n: 8987 })).toBe(
      "Median from 0.28 for Under 2,000 to 0.89 for 7,000+; 2 groups; 8,987 stories.",
    );
    expect(oneGroupNote({ label: "Past tense", stats: { n: 102 } })).toBe(
      "Only “Past tense” has enough stories in this selection (102).",
    );
  });
});

describe("the chart", () => {
  const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const stats = (median, n = 100) => ({ n, median, p25: median * 0.6, p75: median * 1.4, mean: median * 1.2 });
  const rows = [
    { index: 0, label: "Under 10%", stats: stats(0.3) },
    { index: 1, label: "10–20%", stats: stats(0.5, 20) },
    { index: 2, label: "20%+", stats: null },
  ];
  const draw = () =>
    render(
      <RangeChart
        rows={rows}
        overall={stats(0.45, 220)}
        metric={metric}
        variable={variable}
        smallN={30}
        minN={10}
        title="How favorites per 1,000 views vary with dialogue share"
        n={230}
      />,
    );

  it("is a named group with focusable, fully labeled rows, small and hidden groups marked, and no mean marker", () => {
    const { container } = draw();
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("role")).toBe("group");
    expect(screen.getByRole("group", { name: /vary with dialogue share/ })).toBeTruthy();
    const rowsEl = screen.getAllByRole("img");
    expect(rowsEl).toHaveLength(3);
    expect(rowsEl[0].getAttribute("tabindex")).toBe("0");
    expect(rowsEl[0].getAttribute("aria-label")).toBe("Under 10%: median 0.30, interquartile range 0.18–0.42, mean 0.36, 100 stories");
    expect(rowsEl[1].getAttribute("class")).toMatch(/small/);
    // a small group's bar is hatched, as a style (the bar's class sets a fill that would win over the attribute)
    const hatch = container.querySelector("pattern").id;
    expect(rowsEl[1].querySelector(".iqr").style.fill).toBe(`url("#${hatch}")`);
    expect(rowsEl[0].querySelector(".iqr").style.fill).toBe("");
    // no row prints its stories: they are in its name and its details (the owner, 2026-10-19)
    expect([...container.querySelectorAll("svg text")].filter((t) => /\d stories/.test(t.textContent))).toEqual([]);
    expect(container.querySelector(".gn, .axis-caption")).toBeNull();
    expect(screen.getByText("Too few stories to show")).toBeTruthy();
    expect(screen.getByText(/Fewer than 30 stories/, { selector: "li" })).toBeTruthy();
    expect(container.querySelector(".mean")).toBeNull();
    expect(container.querySelector("path")).toBeNull(); // the old diamond and triangle markers were paths
    expect(screen.queryByText(/Mean/)).toBeNull(); // only in the tooltip and the table
  });

  it("pins the details on a tap, and Escape dismisses them", () => {
    draw();
    const row = screen.getAllByRole("img")[0];
    fireEvent.pointerEnter(row, { pointerType: "touch" });
    fireEvent.click(row);
    expect(screen.getByText("Median", { selector: "dt" })).toBeTruthy();
    expect(screen.getByText("Mean", { selector: "dt" })).toBeTruthy();
    // a pinned tooltip stays when the finger lifts or the pointer leaves
    fireEvent.pointerLeave(row, { pointerType: "touch" });
    expect(screen.getByText("Mean", { selector: "dt" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Mean", { selector: "dt" })).toBeNull();
    // a tap elsewhere also closes it
    fireEvent.click(row);
    expect(screen.getByText("Mean", { selector: "dt" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Mean", { selector: "dt" })).toBeNull();
  });

  it("shows the details on hover and focus", () => {
    draw();
    const row = screen.getAllByRole("img")[1];
    fireEvent.pointerEnter(row, { pointerType: "mouse" });
    expect(screen.getByText("Median", { selector: "dt" })).toBeTruthy();
    fireEvent.pointerLeave(row, { pointerType: "mouse" });
    expect(screen.queryByText("Median", { selector: "dt" })).toBeNull();
    fireEvent.focus(row);
    expect(screen.getByText("Median", { selector: "dt" })).toBeTruthy();
  });
});
