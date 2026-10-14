// Round 3, change 4: visitors are assumed to know the median and the interquartile range. Nothing they can read calls
// the median "the typical story" (or its age "typical age") or the interquartile range "the middle half".
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import RangeChart from "../components/RangeChart.jsx";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_WORDS = /typical story|typical age|middle half/i;

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === "test" ? [] : sources(p);
    return /\.(jsx?|css)$/.test(name) ? [p] : [];
  });
}

/** Every string in meta.json a visitor can read (not ids, dates, file names or search-only synonyms). */
function visitorStrings(meta) {
  const skip = new Set(["id", "generated_at", "source", "var", "metric", "genre", "mode", "kind", "unit", "ids", "topic", "default_metric", "format", "syn"]);
  const out = [];
  const walk = (x, key) => {
    if (skip.has(key)) return;
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach((v) => walk(v, key));
    else if (x && typeof x === "object") Object.entries(x).forEach(([k, v]) => walk(v, k));
  };
  walk(meta);
  return out;
}

describe("no “typical story”, “typical age” or “middle half” anywhere a visitor reads", () => {
  it("in the site's source, comments aside", () => {
    for (const f of [...sources(SRC), path.join(SRC, "..", "index.html")]) {
      const text = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
        .replace(/<!--[\s\S]*?-->/g, "");
      expect(text, path.relative(SRC, f)).not.toMatch(OLD_WORDS);
    }
  });

  it("in meta.json", () => {
    for (const meta of [fixtureMeta, realMeta()].filter(Boolean)) {
      expect(visitorStrings(meta).filter((s) => OLD_WORDS.test(s))).toEqual([]);
    }
  });
});

describe("the chart's words", () => {
  const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const stats = (median, n = 100) => ({ n, median, p25: median * 0.36, p75: median * 2.36, mean: median * 1.64 });
  const rows = [
    { index: 0, label: "Under 2,000", stats: stats(0.28, 2708) },
    { index: 1, label: "7,000+", stats: stats(0.89, 20) },
  ];

  it("legend and details card say median and interquartile range", () => {
    const { container } = render(
      <RangeChart rows={rows} overall={stats(0.45, 2728)} metric={metric} variable={variable} smallN={30} minN={10} title="T" n={2728} />,
    );
    expect([...container.querySelectorAll(".legend li")].map((li) => li.textContent.trim())).toEqual([
      "Median",
      "Interquartile range",
      "Fewer than 30 stories",
    ]); // the dashed line names itself under the plot ("Median of all stories: …"; the owner, 2026-10-13)
    expect(container.querySelector(".reflab").textContent).toMatch(/^Median of all stories: /);
    fireEvent.click(screen.getAllByRole("img")[0]);
    expect([...container.querySelectorAll(".chart-tip dt")].map((dt) => dt.textContent)).toEqual([
      "Median",
      "Interquartile range",
      "Mean",
      "Stories",
    ]);
    expect(screen.getAllByRole("img")[0].getAttribute("aria-label")).toBe(
      "Under 2,000: median 0.28, interquartile range 0.10–0.66, mean 0.46, 2,708 stories",
    );
  });
});

describe("How it works", () => {
  beforeEach(() => {
    clearCache();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", fixtureFetch());
  });

  it("says median and interquartile range without explaining them", async () => {
    window.history.replaceState(null, "", "/#/methodology");
    render(<App />);
    const short = await screen.findByRole("complementary", { name: "In short" });
    expect(within(short).getAllByRole("listitem")[3].textContent).toBe(
      "Each group of stories is summarized by its median and interquartile range; groups of fewer than 10 stories are hidden.",
    );
    const text = document.querySelector(".methodology").textContent.replace(/\s+/g, " ");
    expect(text).toContain(
      "For each group the charts show the median, the interquartile range and the number of stories. The mean " +
        "(which a few very popular stories can pull up) is in each group’s details.",
    );
    // "tend to"'s three conditions are a numbered list (the owner's readable page, 2026-10-14)
    expect(text).toContain("All three must hold:");
    expect(text).toContain("The medians of the lowest and highest groups differ by at least 10% (or 0.1 stars for ratings).");
    expect(text).toContain("Even a clear pattern describes the medians; individual stories vary widely.");
    expect(text).toContain("are not typical readers"); // other uses of “typical” stay
  });
});
