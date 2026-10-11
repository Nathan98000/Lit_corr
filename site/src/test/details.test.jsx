// A row's details on phones (F43, concept K1): a line under the chart, inside its frame, above the caption.
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RangeChart from "../components/RangeChart.jsx";
import { fixtureMeta } from "./fixtures.js";

const metric = fixtureMeta.metrics.find((m) => m.id === "pop_fav_per_1k_views");
const variable = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
const stats = (median, n = 2708, age = 12.2) => ({ n, age, median, p25: median * 0.36, p75: median * 2.36, mean: median * 1.64 });
const rows = [
  { index: 0, label: "Under 2,000", stats: stats(0.28) },
  { index: 1, label: "2,000–3,000", stats: stats(0.38, 1625, 10.4) },
  { index: 2, label: "3–7", stats: null },
];

/** Charts measure their own width: make every element 343 px wide (a 375 px phone minus the page's padding). */
function phoneWidth(width = 343) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
}

const draw = () =>
  render(
    <>
      <p>Outside the chart</p>
      <RangeChart rows={rows} overall={stats(0.45)} metric={metric} variable={variable} smallN={30} minN={10} title="T" n={4400} />
    </>,
  );
const lines = () => [...document.querySelectorAll(".row-details")];
const shownLine = () => lines().map((l) => l.textContent).join("");

beforeEach(() => phoneWidth());
afterEach(() => vi.restoreAllMocks());

describe("the details line on phones", () => {
  it("shows a tapped row's numbers in one line under the chart, and no floating card", () => {
    const { container } = draw();
    const frame = container.querySelector(".chart-frame");
    const [first] = screen.getAllByRole("img");
    fireEvent.click(first);
    expect(shownLine()).toBe(
      "Under 2,000 median 0.28 · interquartile range 0.10–0.66 · mean 0.46 · 2,708 stories. Tap again to close.",
    );
    expect(frame.contains(lines()[0])).toBe(true); // inside the chart frame, at its end: under the rows
    expect(frame.lastElementChild).toBe(lines()[1]);
    expect(lines()[0].getAttribute("aria-live")).toBe("polite");
    expect(lines()[0].textContent).not.toBe(""); // a tap's details are announced
    expect(container.querySelector(".chart-tip")).toBeNull();
    expect(container.querySelector("svg").getAttribute("class")).toMatch(/has-active/); // the others are dimmed
    expect(first.getAttribute("class")).toMatch(/active/);
  });

  it("closes on a second tap, switches to another row, and closes on Escape or a tap outside", async () => {
    draw();
    const [first, second, hidden] = screen.getAllByRole("img");
    fireEvent.click(first);
    fireEvent.click(first);
    expect(shownLine()).toBe("");
    fireEvent.click(first);
    fireEvent.click(second);
    expect(shownLine()).toMatch(/^2,000–3,000 median 0\.38 /);
    fireEvent.click(hidden);
    expect(shownLine()).toBe("3–7 fewer than 10 stories, so this group is not shown.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(shownLine()).toBe("");
    fireEvent.click(second);
    fireEvent.pointerDown(screen.getByText("Outside the chart"));
    expect(shownLine()).toBe("");
  });

  it("shows the focused row's details too, without announcing them twice", async () => {
    const user = userEvent.setup();
    draw();
    await user.tab();
    expect(shownLine()).toMatch(/^Under 2,000 median 0\.28 .* 2,708 stories\.$/); // no "Tap again"
    expect(lines()[0].textContent).toBe(""); // the live line stays quiet: the row's name says the same
    await user.keyboard("{ArrowDown}");
    expect(shownLine()).toMatch(/^2,000–3,000 /);
    await user.keyboard("{Escape}");
    expect(shownLine()).toBe("");
  });

  it("never says the median age: not in the phone's line, the card or the rows' names (decision 2)", () => {
    const { container } = draw();
    for (const row of screen.getAllByRole("img")) {
      expect(row.getAttribute("aria-label")).not.toMatch(/age/i);
      fireEvent.click(row);
      expect(shownLine()).not.toMatch(/age|year/i);
      fireEvent.click(row);
    }
    vi.restoreAllMocks();
    phoneWidth(720);
    const wide = draw();
    fireEvent.click(within(wide.container).getAllByRole("img")[0]);
    expect(wide.container.querySelector(".chart-tip").textContent).not.toMatch(/age|year/i);
    expect([...wide.container.querySelectorAll(".chart-tip dt")].map((dt) => dt.textContent)).toEqual([
      "Median",
      "Interquartile range",
      "Mean",
      "Stories",
    ]);
    expect(container.textContent).not.toMatch(/median age/i);
  });

  it("keeps the floating card on wider charts", () => {
    vi.restoreAllMocks();
    phoneWidth(720);
    const { container } = draw();
    fireEvent.click(screen.getAllByRole("img")[0]);
    expect(container.querySelector(".chart-tip")).toBeTruthy();
    expect(container.querySelector(".row-details")).toBeNull();
  });
});
