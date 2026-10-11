// The Genres page review's quick wins (its section 6): focus after "Show all stories" (F64; the story-age note's
// comparison is gone), the genres file fetched at once when a visit starts on the page (F68), the compact desktop card
// (F70), and a pixel more between a genre's name and its count on phones.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { cardHeight, cardWidth } from "../components/GenreDetails.jsx";
import { clearCache } from "../lib/data.js";
import { rowGrid } from "../lib/genreLayout.js";
import { rangeLayout } from "../lib/rangeLayout.js";
import { fixtureFetch } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openGenres(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const answerHeading = () => document.querySelector(".genres-page .chart-title");
const settled = () => waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());

describe("focus after a button that changes the answer (F64)", () => {
  it("moves to the heading of the new answer after “Show all stories”", async () => {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("genres/y2020")) return res;
      const body = await res.json();
      body.n[2] = 5; // Romance: too few stories published 2020 or later
      return { ok: true, status: 200, json: async () => body };
    });
    const user = await openGenres("#/genres?view=genre&genre=romance&include=y2020");
    expect(answerHeading().textContent).toMatch(/^Fewer than 10 stories in Romance match/);
    await user.click(screen.getByRole("button", { name: "Show all stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
    await settled();
    // the heading drawn anew for the whole answer
    expect(answerHeading().textContent).toMatch(/characteristics? clearly sets? Romance apart|No characteristic clearly sets Romance/);
    expect(document.activeElement).toBe(answerHeading());
  });

  it("has no “Show all stories” when all stories are shown already", async () => {
    await openGenres("#/genres?view=genre&genre=tiny&include=all");
    expect(answerHeading().textContent).toBe("Fewer than 10 stories in Tiny Genre match “All stories”: too few to compare.");
    expect(screen.queryByRole("button", { name: "Show all stories" })).toBeNull();
  });
});

describe("focus after “Try again”", () => {
  it("moves to the heading of the answer it brings", async () => {
    const serve = fixtureFetch();
    let fail = true;
    vi.stubGlobal("fetch", async (url) => {
      if (fail && String(url).includes("genres/")) throw new Error("Failed to fetch");
      return serve(url);
    });
    window.history.replaceState(null, "", "/#/genres?var=dlg_word_share");
    const user = userEvent.setup();
    render(<App />);
    const again = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    await user.click(again);
    await settled();
    await waitFor(() => expect(document.activeElement).toBe(answerHeading()));
  });
});

describe("a visit that starts on the Genres page (F68)", () => {
  it("fetches the page's file before meta.json has arrived", async () => {
    const asked = [];
    const serve = fixtureFetch();
    let release;
    const metaArrives = new Promise((r) => {
      release = r;
    });
    vi.stubGlobal("fetch", async (url) => {
      asked.push(String(url));
      if (String(url).endsWith("meta.json")) await metaArrives;
      return serve(url);
    });
    window.history.replaceState(null, "", "/#/genres?view=genre&genre=romance&include=y2020");
    render(<App />);
    expect(asked.some((u) => u.endsWith("genres/y2020.json"))).toBe(true);
    expect(asked.findIndex((u) => u.endsWith("genres/y2020.json"))).toBeLessThan(asked.findIndex((u) => u.endsWith("meta.json")));
    release();
    await settled();
    expect(asked.filter((u) => u.endsWith("genres/y2020.json"))).toHaveLength(1); // the page reads the same request
  });

  it("does not fetch it for other pages", () => {
    const asked = [];
    vi.stubGlobal("fetch", async (url) => {
      asked.push(String(url));
      return new Promise(() => {});
    });
    window.history.replaceState(null, "", "/#/explore");
    render(<App />);
    expect(asked.some((u) => u.includes("genres/"))).toBe(false);
  });
});

describe("the desktop card (F70)", () => {
  const row = { genre: { id: "adult-romance", name: "Romance" }, all: false };
  const numbers = {
    items: [
      ["Median", "4,390 words"],
      ["Interquartile range", "2,250–8,150"],
      ["Stories", "300"],
    ],
    comparison: { short: "No clear difference" },
    line: "",
  };

  it("puts its numbers two pairs to a line, about 140 px tall", () => {
    expect(cardHeight(row, numbers)).toBeLessThanOrEqual(140);
    const groups = { ...numbers, items: [...numbers.items, ["A", "1%"], ["B", "2%"], ["C", "3%"], ["D", "4%"], ["E", "90%"]] };
    expect(cardHeight(row, groups) - cardHeight(row, numbers)).toBe(2 * 19); // eight numbers: four lines
  });

  it("is as wide as its content, up to 420 px", () => {
    const w = cardWidth(row, numbers);
    expect(w).toBeGreaterThan(200);
    expect(w).toBeLessThanOrEqual(420);
    const long = { genre: { id: "x", name: "Reluctance/NonConsent" }, all: false };
    expect(cardWidth(long, { ...numbers, items: [...numbers.items, ["First person plural (we)", "0.1%"]] })).toBeLessThanOrEqual(420);
    const css = readFileSync(path.join(here, "..", "genres.css"), "utf8");
    expect(css).toMatch(/\.genre-tip dl \{\s*grid-template-columns: repeat\(4, auto\);/);
    expect(css).toMatch(/\.genre-tip \{[^}]*max-width: 420px;/);
  });
});

describe("a genre's name and its count on phones", () => {
  it("are a pixel further apart than the name's line height", () => {
    const grid = rowGrid({ rows: [{ index: 1, label: "Anal", n: 119 }], width: 343 });
    const [r] = grid.rows;
    expect(r.count.y - r.labelLines[0].y).toBe(15);
    expect(r.y1 - r.y0).toBe(44); // rows keep their 44 px
    const layout = rangeLayout({
      rows: [
        { index: 0, label: "All genres", stats: { n: 900, p25: 1, median: 2, p75: 3 } },
        { index: 1, label: "Anal", stats: { n: 119, p25: 1, median: 2, p75: 3 } },
      ],
      overall: { n: 900, p25: 1, median: 2, p75: 3 },
      format: "count",
      width: 343,
      valueColumn: true,
      storiesColumn: true,
      phoneLabelW: 116,
    });
    const anal = layout.rows[1];
    expect(anal.nPos.y - anal.labelLines[0].y).toBe(15);
    expect(anal.y1 - anal.y0).toBe(44);
  });
});

describe("a tapped genre on a phone (F62, concept Q1)", () => {
  it("keeps its line at the bottom of the screen while the chart is on screen", () => {
    const css = readFileSync(path.join(here, "..", "genres.css"), "utf8");
    const rule = css.match(/\.row-details\.genre-line:not\(\.empty\) \{([^}]*)\}/)[1];
    expect(rule).toMatch(/position: sticky;/);
    expect(rule).toMatch(/bottom: 0;/);
    expect(rule).toMatch(/box-shadow:/);
  });

  it("is the chart's last part, so it can stick for the whole chart, and stays after it in the document", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    await openGenres("#/genres?var=dlg_word_share");
    const frame = document.querySelector(".genre-chart .chart-frame");
    expect(frame.lastElementChild.classList.contains("genre-line")).toBe(true);
  });

  it("never covers a row focused from the keyboard", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    vi.restoreAllMocks();
    const scrolled = [];
    window.scrollBy = (x, y) => scrolled.push(y);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
      if (this.classList?.contains("genre-line")) return { width: 343, height: 120, top: 547, bottom: 667, left: 0, right: 343 };
      if (this.classList?.contains("row")) return { width: 343, height: 44, top: 520, bottom: 564, left: 0, right: 343 };
      return { width: 343, height: 0, top: 0, bottom: 0, left: 0, right: 343 };
    });
    window.innerHeight = 667;
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => expect(document.querySelector(".genre-chart.mode-side")).toBeTruthy());
    const row = document.querySelector(".genre-chart .row[tabindex='0']");
    row.focus();
    await waitFor(() => expect(document.querySelector(".genre-line:not(.empty)")).toBeTruthy());
    await waitFor(() => expect(scrolled).toContain(564 + 4 - 547));
    delete window.scrollBy;
  });
});
