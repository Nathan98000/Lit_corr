// Round 3, change 2: story length is measured in words, and every chart says what its rows are, and in what unit,
// above the first row; since the owner's follow-up, on a line of its own, and not for yes/no characteristics.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RangeChart from "../components/RangeChart.jsx";
import { rangeLayout } from "../lib/rangeLayout.js";
import { chartTitle, groupedBy, questionText, unitNote } from "../lib/wording.js";
import { fixtureMeta, realMeta } from "./fixtures.js";

const real = realMeta();
const ranges = (noun, unit) => ({ noun, unit, bins: { type: "ranges" } });

afterEach(() => vi.restoreAllMocks());

describe("the line that says what the rows are", () => {
  it("names the unit once, and only when the noun does not", () => {
    expect(groupedBy(ranges("story length in words", "words"))).toBe("Stories grouped by story length in words");
    expect(groupedBy(ranges("anger", "per 1,000 words"))).toBe("Stories grouped by anger (per 1,000 words)");
    expect(groupedBy(ranges("dialogue segments per 1,000 words", "per 1,000 words"))).toBe(
      "Stories grouped by dialogue segments per 1,000 words",
    );
    expect(unitNote(ranges("title word count", "words"))).toBe("");
    expect(unitNote(ranges("the number of sentences", "sentences"))).toBe("");
    expect(unitNote(ranges("‘filter’ words", "per 1,000 words"))).toBe(" (per 1,000 words)"); // a rate, not a count
    expect(unitNote(ranges("story age", "years"))).toBe(" (years)");
    expect(unitNote(ranges("dialogue share", "share (0–1)"))).toBe(""); // the labels say 10%, 20% …
    expect(unitNote({ noun: "publication month", unit: "month (1–12)", bins: { type: "levels" } })).toBe("");
  });

  it.skipIf(!real)("reads “word count” on the real data (one name for the idea, round 4's O9)", () => {
    const words = real.variables.find((v) => v.id === "story_words");
    const rating = real.metrics.find((m) => m.id === "pop_rating");
    expect(words.noun).toBe("word count");
    expect(questionText({ variable: words, metric: rating, genre: real.genres[0] })).toBe(
      "In all genres, how does the average rating vary with word count?",
    );
    expect(chartTitle({ variable: words, metric: rating, genre: real.genres[0], direction: 0 })).toBe(
      "How the average rating varies with word count across all genres",
    );
    expect(groupedBy(words)).toBe("Stories grouped by word count");
    for (const v of real.variables) expect(groupedBy(v)).not.toMatch(/\((\w[\w ,]*)\).*\(\1\)|in words \(words\)/);
    // no "Stories grouped by has dialogue": yes/no characteristics have no such line
    for (const v of real.variables) expect(groupedBy(v) === "").toBe(Boolean(v.yes_subject));
  });
});

describe("above the first row", () => {
  const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
  const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
  const binary = fixtureMeta.variables.find((v) => v.id === "dlg_has_dialogue");
  const stats = (median, n = 100) => ({ n, median, p25: median * 0.6, p75: median * 1.4, mean: median * 1.2 });
  const rows = ["Under 10%", "10–20%", "20–25%", "25%+"].map((label, index) => ({ index, label, stats: stats(0.3 + index / 10) }));
  const draw = (props = {}) =>
    render(<RangeChart rows={rows} overall={stats(0.45)} metric={metric} variable={variable} smallN={30} minN={10} title="T" n={400} {...props} />);
  const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("is a line of its own across the chart, followed by the axis title from where the plot starts", () => {
    const { container } = draw(); // jsdom draws at 720 px: labels in a column beside the bars
    expect(container.querySelector(".chart-heads")).toBeNull(); // no longer a heading wrapped into the label column
    const groups = container.querySelector(".axis-groups");
    const title = container.querySelector(".axis-title");
    expect(groups.textContent).toBe("Stories grouped by dialogue share");
    expect(groups.style.paddingLeft).toBe(""); // from the chart's left edge
    expect(groups.nextElementSibling).toBe(title);
    expect(title.textContent).toBe("Favorites per 1,000 views");
    const layout = rangeLayout({ rows, overall: stats(0.45), format: metric.format, width: 720 });
    expect(title.style.paddingLeft).toBe(`${layout.left}px`); // the axis title starts where the plot does
    expect(before(title, container.querySelector("svg"))).toBe(true);
    expect(container.querySelector(".axis-caption")).toBeNull(); // no small groups: nothing under the chart
  });

  it("on phones too: the line first, then the axis title right above the ticks", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    const { container } = draw();
    const groups = container.querySelector(".axis-groups");
    const title = container.querySelector(".axis-title");
    expect(groups.nextElementSibling).toBe(title);
    expect(title.style.paddingLeft).toBe(""); // labels above the bars: the plot starts at the chart's edge
    expect(before(title, container.querySelector("svg"))).toBe(true);
  });

  const yesNo = [
    { index: 0, label: "Has dialogue", stats: stats(0.5, 20) },
    { index: 1, label: "No dialogue", stats: stats(0.4) },
  ];

  it("keeps hyphenated words whole, and leaves only the small-groups note under the chart", () => {
    const v = { ...variable, noun: "the present-tense share of the narration" };
    const { container } = draw({ rows: yesNo, variable: v });
    expect(container.querySelector(".axis-groups .nowrap").textContent).toBe("present-tense");
    const caption = container.querySelector(".axis-caption");
    expect(caption.textContent).toBe("* Fewer than 30 stories: worth less trust.");
    expect(before(container.querySelector("svg"), caption)).toBe(true);
  });

  it("is left out for a yes/no characteristic, whose two rows name themselves", () => {
    const { container } = draw({ rows: yesNo, variable: binary });
    expect(groupedBy(binary)).toBe("");
    expect(container.querySelector(".axis-groups")).toBeNull();
    expect(container.querySelector(".axis-title").textContent).toBe("Favorites per 1,000 views");
    expect(container.textContent).not.toMatch(/grouped by/);
  });
});
