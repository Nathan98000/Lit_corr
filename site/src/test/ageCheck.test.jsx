// Round 3, change 3: "Stories of similar age" as one aligned chart: the group labels once, a column per period with
// one dot per group, the verdicts in the headings, the numbers in a hidden table, one tab stop per column.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { AgeChart } from "../components/AgeCheckCharts.jsx";
import { ageLayout } from "../lib/ageLayout.js";
import { clearCache } from "../lib/data.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share"); // ordered, five groups
const labels = variable.bins.labels;
const subsets = ["y2000", "y2010", "y2020"].map((id) => fixtureMeta.subsets.find((s) => s.id === id));
const stats = (median, n) => ({ n, age: 9, median, p25: median * 0.6, p75: median * 1.4, mean: median * 1.2 });

/** Three periods: the first with every group at 100 stories, the second with a group of 20 (hollow) and one of 6. */
function periods() {
  const counts = [
    [100, 100, 100, 100, 100],
    [100, 20, 6, 100, 100],
    [100, 100, 100, 100, 100],
  ];
  const verdicts = [["↗ tends higher", 1], ["no clear pattern", 0], ["too few stories to judge", 0]];
  return subsets.map((subset, p) => ({
    id: subset.id,
    subset,
    gd: { n: counts[p].reduce((a, b) => a + b, 0) },
    rows: labels.map((label, i) => ({
      index: i,
      label,
      stats: counts[p][i] < 10 ? { n: counts[p][i], age: 9, suppressed: true } : stats(0.3 + i * 0.1 + p * 0.05, counts[p][i]),
    })),
    overall: stats(0.45 + p * 0.05, 400),
    verdict: verdicts[p][0],
    direction: verdicts[p][1],
  }));
}
const d = { variable, metric, genre: fixtureMeta.genres[0], k: 0 };
const draw = () => render(<AgeChart meta={fixtureMeta} d={d} periods={periods()} />);
const chartWidth = (width) =>
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });

afterEach(() => vi.restoreAllMocks());

describe("one aligned chart, three columns", () => {
  it("names each group once, and draws one mark per group per period: filled, hollow or a dash", () => {
    const { container } = draw(); // jsdom draws at 720 px: three columns side by side
    expect([...container.querySelectorAll(".age-label")].map((l) => l.textContent)).toEqual(labels);
    expect(container.querySelectorAll(".age-col")).toHaveLength(3);
    const cols = [...container.querySelectorAll(".age-col")];
    for (const col of cols) expect(col.querySelectorAll(".age-cell")).toHaveLength(labels.length);
    const marks = (col) => [...col.querySelectorAll(".age-cell")].map((c) => c.querySelector(".age-dot.hollow") ? "hollow" : c.querySelector(".age-dot") ? "dot" : c.querySelector(".age-dash") ? "dash" : "?");
    expect(marks(cols[0])).toEqual(["dot", "dot", "dot", "dot", "dot"]);
    expect(marks(cols[1])).toEqual(["dot", "hollow", "dash", "dot", "dot"]);
    // no interquartile bars, printed values, per-row counts or "All stories shown" labels
    expect(container.querySelector(".iqr, .gval, .gn, .reflab")).toBeNull();
    expect(container.textContent).not.toMatch(/n = |All stories shown:/);
    // each column keeps its dashed line; the dots of an ordered characteristic are joined
    for (const col of cols) expect(col.querySelectorAll(".age-ref")).toHaveLength(1);
    expect(cols[1].querySelector(".age-line").getAttribute("d").match(/[ML]/g)).toHaveLength(4); // the dash is skipped
  });

  it("heads each column with its period, its number of stories and its verdict", () => {
    const { container } = draw();
    const heads = [...container.querySelectorAll(".age-period-head")];
    expect(heads.map((h) => h.querySelector("h4 [aria-hidden]").textContent.replace(/⁠/g, ""))).toEqual([
      "2000–2009",
      "2010–2019",
      "2020 or later",
    ]);
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent.replace(/2000⁠–⁠2009|2010⁠–⁠2019|2020 or later$/, ""))).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 4, name: /^Published 2000–2009/ })).toBeTruthy();
    expect(heads.map((h) => h.querySelector(".age-period-meta").textContent)).toEqual(["500 stories", "326 stories", "500 stories"]);
    expect(heads.map((h) => h.querySelector(".age-verdict").textContent)).toEqual([
      "↗ tends higher",
      "no clear pattern",
      "too few stories to judge",
    ]);
  });

  it("gives screen readers the numbers in a hidden table: period × group, median and stories", () => {
    draw();
    const table = screen.getByRole("table");
    expect(table.parentElement.className).toBe("visually-hidden"); // a hidden box: the table never widens the page
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Group",
      "Published 2000–2009: tends higher",
      "Published 2010–2019: no clear pattern",
      "Published 2020 or later: too few stories to judge",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual([...labels, "All stories shown"]);
    expect(within(rows[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "median 0.40, 100 stories",
      "median 0.45, 20 stories",
      "median 0.50, 100 stories",
    ]);
    expect(within(rows[2]).getAllByRole("cell")[1].textContent).toBe("fewer than 10 stories");
  });

  it("is one tab stop per column; the arrows move between groups and show their details", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Before</button>
        <AgeChart meta={fixtureMeta} d={d} periods={periods()} />
      </>,
    );
    const cells = (col) => [...container.querySelectorAll(".age-col")[col].querySelectorAll(".age-cell")];
    expect(cells(0).map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(cells(0)[0]);
    expect(container.querySelector(".chart-tip strong").textContent).toBe(labels[0]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(cells(0)[2]);
    expect(container.querySelector(".chart-tip .tip-period").textContent).toBe("Published 2000–2009");
    expect([...container.querySelectorAll(".chart-tip dt")].map((dt) => dt.textContent)).toEqual([
      "Median",
      "Interquartile range",
      "Mean",
      "Stories",
      "Median age",
    ]);
    await user.tab(); // the next column
    expect(document.activeElement).toBe(cells(1)[0]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(cells(1)[4]);
    expect(cells(1)[4].getAttribute("aria-label")).toMatch(
      new RegExp(`^${labels[4].replace("+", "\\+")}, published 2010–2019: median 0\\.75, interquartile range .*, 100 stories, median age 9 years$`),
    );
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(cells(1)[2]);
    expect(cells(1)[2].getAttribute("aria-label")).toBe(`${labels[2]}, published 2010–2019: fewer than 10 stories, not shown`);
    await user.keyboard("{Escape}");
    expect(container.querySelector(".chart-tip")).toBeNull();
  });

  it("on phones, shows a tapped group's details in a line under the chart", () => {
    chartWidth(343);
    const { container } = draw();
    const cell = container.querySelectorAll(".age-col")[1].querySelectorAll(".age-cell")[1];
    fireEvent.click(cell);
    expect(container.querySelector(".chart-tip")).toBeNull();
    const line = [...container.querySelectorAll(".row-details")].map((p) => p.textContent).join("");
    expect(line).toMatch(
      new RegExp(`^${labels[1]}, published 2010–2019: median 0\\.45 · interquartile range 0\\.27–0\\.63 · mean 0\\.54 · 20 stories · median age 9 years\\. Tap again to close\\.$`),
    );
    fireEvent.click(cell);
    expect([...container.querySelectorAll(".row-details")].map((p) => p.textContent).join("")).toBe("");
  });
});

describe("the layout", () => {
  const ps = periods();
  it("keeps the three columns side by side on a 375 px phone and stacks them on a 320 px one", () => {
    const phone = ageLayout({ periods: ps, labels, format: "rate", width: 343 });
    expect(phone).toMatchObject({ side: true, labelW: 84 });
    expect(phone.colW).toBeGreaterThanOrEqual(72);
    expect(ageLayout({ periods: ps, labels, format: "rate", width: 288 }).side).toBe(false);
    const wide = ageLayout({ periods: ps, labels, format: "rate", width: 1032 });
    expect(wide.side).toBe(true);
    expect(wide.rowY(1) - wide.rowY(0)).toBe(32);
  });

  it("labels three or four ticks per column, on one scale for the three periods", () => {
    for (const width of [343, 720, 1032]) {
      const L = ageLayout({ periods: ps, labels, format: "rate", width });
      const labeled = L.ticks.filter((t) => t.text);
      expect(labeled.length).toBeGreaterThanOrEqual(3);
      expect(labeled.length).toBeLessThanOrEqual(4);
      expect(L.lo).toBe(0);
      expect(L.hi).toBeGreaterThanOrEqual(0.75); // the largest median of any period fits
    }
    const rating = ageLayout({ periods: ps.map((p) => ({ ...p, rows: p.rows.map((r) => ({ ...r, stats: r.stats.suppressed ? r.stats : { ...r.stats, median: 4 + r.stats.median } })), overall: { ...p.overall, median: 4.5 } })), labels, format: "rating", width: 1032 });
    expect(rating.lo).toBeGreaterThan(3); // ratings keep their zoomed axis
  });
});

describe("the section", () => {
  beforeEach(() => {
    clearCache();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", fixtureFetch());
  });

  it("keeps its heading, Close and caption, and explains the marks once, in one line under the caption", async () => {
    // the fixtures' end groups of dialogue share made 15 and 3 years old, so that the age box offers the check
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("v/dlg_word_share/")) return res;
      const body = await res.json();
      for (const gd of Object.values(body.g)) {
        const cs = gd.b.filter(Boolean);
        if (cs.length >= 2) {
          cs[0][1] = 15;
          cs[cs.length - 1][1] = 3;
        }
      }
      return { ok: true, status: 200, json: async () => body };
    });
    window.history.replaceState(null, "", "/#/explore?var=dlg_word_share&check=age");
    render(<App />);
    const section = (await screen.findByRole("heading", { name: "Stories of similar age" })).closest("section");
    expect(within(section).getByRole("button", { name: "Close" })).toBeTruthy();
    expect(section.querySelector(".axis-caption").textContent).toBe(
      "The same chart within three publication periods, so the stories compared are of similar age.",
    );
    expect(section.querySelector(".age-legend").textContent).toBe(
      "Dots: each group’s median within the period. Dashed line: the median of all its stories. Hollow dots: fewer " +
        "than 30 stories; a dash: fewer than 10.",
    );
    await waitFor(() => expect(section.querySelectorAll(".age-col")).toHaveLength(3));
    expect(section.querySelectorAll(".range-chart")).toHaveLength(0); // no small copies of the main chart any more
  });
});
