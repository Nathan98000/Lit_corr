// The Genres page, one characteristic in every genre (View 1): headings, lists, order, marks, the age note, details,
// the keyboard and the table, for numbers and yes/no characteristics.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import {
  allGenresLine,
  chartHeading,
  chartQuestionText,
  comparison,
  directionWords,
  formatNumber,
  formatPercent,
  genreRows,
  orderRows,
  plainUnit,
  rowDetails,
  rowsHeading,
  takeawayLists,
  tooFewLine,
  withUnit,
} from "../lib/genres.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realFile = (sub = "all") =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "genres", `${sub}.json`), "utf8"));
const v = (meta, id) => meta.variables.find((x) => x.id === id);
const text = (segs) => segs.map((s) => (typeof s === "string" ? s : s.strong)).join("");

/**
 * The test data's genres files, with differences put in on purpose: in dialogue share Romance clearly lower (r −0.32)
 * and Fetish clearly higher (+0.25); in "has dialogue" Romance clearly more common; and genres published years apart.
 */
function flaggedFetch({ ages = [11, 4.1, 16.2, null] } = {}) {
  const serve = fixtureFetch();
  const fn = async (url) => {
    const res = await serve(url);
    if (!String(url).includes("genres/")) return res;
    const body = await res.json();
    const c = body.c;
    c.dlg_word_share.r = [null, 0.25, -0.32, null];
    c.dlg_word_share.f = [0, 1, -1, 0];
    c.dlg_has_dialogue.r = [null, 0.01, 0.21, null];
    c.dlg_has_dialogue.f = [0, 0, 1, 0];
    body.age = ages;
    return { ok: true, status: 200, json: async () => body };
  };
  fn.calls = serve.calls;
  return fn;
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", flaggedFetch());
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

const heading = () => document.querySelector(".genres-page .chart-title").textContent;
const rowNames = () => [...document.querySelectorAll(".genre-chart .row")].map((r) => r.getAttribute("aria-label"));

describe("headings and lists", () => {
  it("say how many genres clearly differ: 0, 1 or k", () => {
    expect(chartHeading(0, 30)).toBe("No genre clearly differs from all genres");
    expect(chartHeading(1, 30)).toBe("1 of 30 genres clearly differs from all genres");
    expect(chartHeading(8, 30)).toBe("8 of 30 genres clearly differ from all genres");
  });

  it("use the D10 words, and Higher / Lower or More common / Less common elsewhere", () => {
    const words = { id: "story_words", more_word: "Longer", less_word: "Shorter", bins: { type: "ranges" } };
    expect(directionWords(words, "num")).toEqual(["Longer", "Shorter"]);
    expect(directionWords({ id: "x", bins: { type: "ranges" } }, "num")).toEqual(["Higher", "Lower"]);
    expect(directionWords({ id: "x", bins: { type: "ranges" } }, "zero")).toEqual(["Higher", "Lower"]);
    expect(directionWords({ id: "x", yes_subject: "Stories with dialogue", bins: { type: "levels" } }, "bin")).toEqual([
      "More common",
      "Less common",
    ]);
    const row = { all: false, small: false, stats: { n: 300 }, f: -1 };
    expect(comparison(row, words, "num")).toMatchObject({ short: "Clearly shorter", long: "clearly shorter than all genres", mark: "▼" });
    expect(comparison({ ...row, f: 1 }, { bins: { type: "levels" }, yes_subject: "S" }, "bin")).toMatchObject({
      short: "Clearly more common",
      long: "clearly more common than in all genres",
      mark: "▲",
    });
    expect(comparison({ ...row, f: 0 }, words, "num").long).toBe("no clear difference from all genres");
    expect(comparison({ ...row, f: 1 }, { bins: { type: "levels" } }, "grp")).toMatchObject({ short: "A clearly different mix", mark: "≠" });
    expect(comparison({ ...row, small: true }, words, "num").short).toBe("Too few stories to compare");
  });

  it.skipIf(!real)("match the acceptance numbers for story length on the real data", () => {
    const file = realFile();
    const rows = genreRows(real, file, "story_words");
    expect(chartHeading(rows.filter((r) => r.f).length, 30)).toBe("8 of 30 genres clearly differ from all genres");
    const lists = takeawayLists(rows, v(real, "story_words"), "num");
    expect(lists.map((l) => [l.mark, l.word, l.names])).toEqual([
      ["▲", "Longer", ["Novels and Novellas"]],
      // ordered by the size of the difference; Anal and Crossdressing tie at r = −0.21, so A–Z
      ["▼", "Shorter", ["Reviews & Essays", "How To", "Letters & Transcripts", "Toys & Masturbation", "Humor & Satire", "Anal", "Crossdressing"]],
    ]);
    expect(text(allGenresLine(rows, v(real, "story_words"), file.c.story_words))).toBe(
      "All genres: median 3,610 words, interquartile range 2,050–6,320. Genre medians run from 1,280 to 5,060.",
    );
    const first = genreRows(real, file, "pov_is_first_person");
    expect(text(allGenresLine(first, v(real, "pov_is_first_person"), file.c.pov_is_first_person))).toBe(
      "All genres: first-person stories make up 57% of stories. Genres run from 27% to 99%.",
    );
    expect(first.filter((r) => r.f).length).toBe(9);
    expect(genreRows(real, file, "rel_romance_per_1k").filter((r) => r.f).map((r) => r.genre.name)).toEqual(["Romance"]);
  });

  it.skipIf(!real)("ask the approved questions, with the genres as the subject", () => {
    expect(chartQuestionText(v(real, "story_words"))).toBe("How do genres differ in story length in words?");
    expect(chartQuestionText(v(real, "pov_is_first_person"))).toBe("How common are first-person stories in each genre?");
    expect(chartQuestionText(v(real, "sex_anatomy_per_1k"))).toBe("How do genres differ in anatomical terms?");
  });

  it("render the heading, the lists with their marks and the All genres line", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    // Tiny Genre (8 stories) is not compared: the heading counts the genres compared (F63) and the takeaway names it
    expect(heading()).toBe("2 of 2 genres clearly differ from all genres");
    expect(document.querySelector(".genre-takeaway .too-few").textContent).toBe("Too few stories to compare: Tiny Genre (fewer than 10).");
    const lists = [...document.querySelectorAll(".genre-list")].map((p) => p.textContent);
    expect(lists).toEqual(["▲ More dialogue: Fetish.", "▼ Less dialogue: Romance."]); // D10's words
    expect(document.querySelector(".all-line").textContent).toMatch(
      /^All genres: median \d+%, interquartile range \d+%–\d+%\. Genre medians run from \d+% to \d+%\.$/,
    );
    expect(document.querySelector(".all-line strong")).toBeTruthy();
  });
});

describe("genres with too few stories to compare (F63)", () => {
  it.skipIf(!real)("are left out of the heading's count and named after the takeaway, A–Z", () => {
    const say = (sub, id) => {
      const rows = genreRows(real, realFile(sub), id);
      return [rowsHeading(rows), tooFewLine(rows, real.min_n)];
    };
    expect(say("y2020", "story_words")).toEqual([
      "8 of 29 genres clearly differ from all genres",
      "Too few stories to compare: Chain Stories (12).",
    ]);
    expect(say("long", "sex_terms_per_1k")).toEqual([
      "12 of 27 genres clearly differ from all genres",
      "Too few stories to compare: How To (13), Letters & Transcripts (29), Reviews & Essays (15).",
    ]);
    // a genre with fewer than 10 stories with the characteristic: the file has no count for it
    expect(say("long", "dlg_adverb_tag_share")[1]).toBe(
      "Too few stories to compare: How To (fewer than 10), Letters & Transcripts (14), Reviews & Essays (fewer than 10).",
    );
  });

  it.skipIf(!real)("change nothing with All stories, except where missing values leave a genre under 30 stories", () => {
    const file = realFile();
    const changed = Object.keys(file.c).filter((id) => tooFewLine(genreRows(real, file, id), real.min_n));
    expect(changed).toEqual(["dlg_adverb_tag_share", "sex_first_scene_position"]);
    const adverbs = genreRows(real, file, "dlg_adverb_tag_share");
    expect(adverbs.filter((r) => !r.all && r.stats && !r.small)).toHaveLength(28); // 28 genres compared, none marked
    expect(rowsHeading(adverbs)).toBe("No genre clearly differs from all genres");
    expect(tooFewLine(adverbs, real.min_n)).toBe("Too few stories to compare: How To (28), Reviews & Essays (20).");
    expect(rowsHeading(genreRows(real, file, "sex_first_scene_position"))).toBe("6 of 29 genres clearly differ from all genres");
    expect(rowsHeading(genreRows(real, file, "story_words"))).toBe("8 of 30 genres clearly differ from all genres");
  });

  it("say the same in the chart's name and the live region", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    const svg = document.querySelector(".genre-chart svg[role=group]");
    expect(document.getElementById(svg.getAttribute("aria-labelledby")).textContent).toBe(
      "How do genres differ in dialogue share? 2 of 2 genres clearly differ from all genres",
    );
    const live = () => document.querySelector(".genres-page > [aria-live='polite']").textContent;
    await waitFor(() => expect(live()).toMatch(/^2 of 2 genres clearly differ from all genres\. /));
  });
});

describe("units and formats", () => {
  it("write a plain unit after a number, never for shares, scales or years", () => {
    const r = (unit) => ({ unit, bins: { type: "ranges" } });
    expect(plainUnit(r("words"))).toBe("words");
    expect(plainUnit(r("per 1,000 words"))).toBe("per 1,000 words");
    expect(plainUnit(r("share (0–1)"))).toBe("");
    expect(plainUnit(r("year"))).toBe("");
    expect(plainUnit(r("US school grade"))).toBe(""); // a scale
    expect(plainUnit(r("part"))).toBe(""); // not a plural
    expect(plainUnit(r("−1 (all negative) to +1 (all positive)"))).toBe("");
    expect(plainUnit(r("words"), "percent")).toBe("");
    expect(withUnit("3,610", 3610, "words")).toBe("3,610 words");
    expect(withUnit("1", 1, "pages")).toBe("1 page");
    expect(withUnit("1", 1, "stories")).toBe("1 story");
    expect(withUnit("0.42", 0.42, "per 1,000 words")).toBe("0.42 per 1,000 words");
  });

  it("print numbers with their three digits, years whole and shares as percentages", () => {
    expect(formatNumber(3610)).toBe("3,610");
    expect(formatNumber(0.422)).toBe("0.422");
    expect(formatNumber(-0.12)).toBe("−0.12");
    expect(formatNumber(2013, "year")).toBe("2013");
    expect(formatPercent(0.553)).toBe("55%");
    expect(formatPercent(0.001)).toBe("0.1%");
    expect(formatPercent(0.008)).toBe("1%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("the chart", () => {
  it("draws numbers as ranges and yes/no characteristics as shares, All genres first", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    const chart = document.querySelector(".genre-chart");
    expect(chart.classList.contains("kind-num")).toBe(true);
    expect(chart.querySelectorAll(".iqr").length).toBe(3); // tiny has too few stories
    expect(rowNames()[0]).toMatch(/^All genres: median \d+%, interquartile range/);
    expect(rowNames()[3]).toBe("Tiny Genre: fewer than 10 stories");
    expect(within(chart).getByText("Fewer than 10 stories")).toBeTruthy();
    expect(chart.querySelector(".reflab").textContent).toMatch(/^All genres: \d+%$/);

    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(document.querySelector(".genre-chart.kind-bin")).toBeTruthy());
    expect(document.querySelectorAll(".genre-chart .share-bar").length).toBe(3);
    expect(document.querySelectorAll(".genre-chart .iqr").length).toBe(0);
    expect(heading()).toBe("1 of 2 genres clearly differs from all genres");
    expect(document.querySelector(".genre-list").textContent).toBe("▲ More common: Romance.");
    expect(document.querySelector(".all-line").textContent).toMatch(/^All genres: stories with dialogue make up \d+% of stories\./);
  });

  it("marks and names the genres that clearly differ", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    const values = [...document.querySelectorAll(".genre-chart .gval")].map((t) => t.textContent);
    expect(values[1]).toMatch(/^▲ \d+%$/); // Fetish
    expect(values[2]).toMatch(/^▼ \d+%$/); // Romance
    expect(values[0]).toMatch(/^\d+%$/);
    expect(rowNames()[1]).toMatch(
      /^Fetish: median \d+%, interquartile range \d+%–\d+%, 150 stories, median age 4\.1 years, clearly more dialogue than all genres$/,
    );
    expect(rowNames()[2]).toMatch(/, clearly less dialogue than all genres$/);
  });

  it("orders the genres by median, or by share, with All genres first and ties A–Z (D3)", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const order = () => rowNames().map((n) => n.split(":")[0]);
    expect(order()).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    expect(screen.getByRole("radiogroup", { name: "Order" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "By median" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all&sort=value"));
    const file = fixtureFile("genres/all.json");
    const meds = { Fetish: file.c.dlg_word_share.q[1][2], Romance: file.c.dlg_word_share.q[2][2] };
    const expected = ["Fetish", "Romance"].sort((a, b) => meds[b] - meds[a]);
    expect(order()).toEqual(["All genres", ...expected, "Tiny Genre"]); // too few stories: last
    // yes/no: "By share"; named groups: no order to choose
    window.location.hash = "#/genres?var=dlg_has_dialogue&sort=value";
    await waitFor(() => expect(screen.getByRole("radio", { name: "By share" }).checked).toBe(true));
    window.location.hash = "#/genres?var=pov_class&sort=value";
    await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "Order" })).toBeNull());
    expect(window.location.hash).toBe("#/genres?var=pov_class&sort=value"); // the address is read, then sanitized
    const rows = [{ all: true, i: 0 }, { i: 1, stats: { median: 2 } }, { i: 2, stats: { median: 5 } }, { i: 3, stats: { median: 2 } }, { i: 4, stats: null }];
    expect(orderRows(rows, "num", "value").map((r) => r.i)).toEqual([0, 2, 1, 3, 4]);
    expect(orderRows(rows, "num", undefined)).toBe(rows);
  });

  it("highlights a genre without moving it", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    await user.selectOptions(screen.getByLabelText("Highlight"), "romance");
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all&genre=romance"));
    const hl = document.querySelector(".genre-chart .row.highlight");
    expect(hl.getAttribute("aria-label")).toMatch(/^Romance:/);
    expect(rowNames().map((n) => n.split(":")[0])).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    expect(document.querySelector(".band-highlight")).toBeTruthy();
  });
});

describe("the story-age note", () => {
  it("shows with All stories when the genres' median ages are 5 or more years apart, and compares 2020 or later", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const box = document.querySelector(".genre-age");
    expect(box.textContent).toMatch(
      /^Story age\. The genres’ stories were published at different times: their median age runs from 4\.1 to 16\.2 years\./,
    );
    await user.click(screen.getByRole("button", { name: "Compare stories published 2020 or later" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=y2020"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(document.querySelector(".genre-age")).toBeNull(); // not with another option
  });

  it("is left out when the ages are close", async () => {
    vi.stubGlobal("fetch", flaggedFetch({ ages: [11, 9.1, 13.9, null] }));
    await openGenres("#/genres?var=dlg_word_share");
    expect(document.querySelector(".genre-age")).toBeNull();
  });
});

describe("details and the keyboard", () => {
  it("is one tab stop; arrows, Home and End move; the card holds the numbers and the link to the genre", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    expect(rows.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    rows[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[1]);
    const card = document.querySelector(".genre-tip");
    expect(card.querySelector("strong").textContent).toBe("Fetish");
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Median", "Interquartile range", "Stories", "Median age"]);
    expect(card.querySelector(".tip-compare").textContent).toBe("Compared with all genres: Clearly more dialogue");
    const link = within(card).getByRole("link", { name: "What stands out about stories in Fetish? →" });
    expect(link.getAttribute("href")).toBe("#/genres?view=genre&genre=fetish&include=all");
    // Tab moves from the row to the link; the card stays
    await user.tab();
    expect(document.activeElement).toBe(link);
    expect(document.querySelector(".genre-tip")).toBeTruthy();
    // Escape goes back to the row
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(rows[1]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(rows[3]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(rows[0]);
    expect(document.querySelector(".genre-tip strong").textContent).toBe("All genres");
    expect(within(document.querySelector(".genre-tip")).queryByRole("link")).toBeNull(); // All genres is no genre
  });

  it("opens one genre from the link as a new history entry", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    fireEvent.click(rows[2]); // a tap keeps the card
    await user.click(within(document.querySelector(".genre-tip")).getByRole("link"));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share"));
  });

  it("shows a line under the chart on phones, with the link, and “Tap again to close.” after a tap", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    await openGenres("#/genres?var=dlg_word_share");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    expect(document.querySelector(".genre-chart").classList.contains("mode-side")).toBe(true); // labels beside the bars
    fireEvent.click(rows[2]);
    const line = document.querySelector(".genre-line");
    expect(line.textContent).toMatch(
      /^Romance median \d+% · interquartile range \d+%–\d+% · 120 stories · median age 16\.2 years · clearly less dialogue than all genres\. What stands out about stories in Romance\? → Tap again to close\.$/,
    );
    expect(line.querySelector("[aria-live]").textContent).toMatch(/^Romance median/);
    expect(document.querySelector(".genre-tip")).toBeNull();
    fireEvent.click(rows[2]);
    expect(document.querySelector(".genre-line").textContent).toBe("");
  });
});

describe("the numbers and the actions", () => {
  it("shows every genre's numbers and comparison, and opens the characteristic in Explore", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share&genre=romance");
    await user.click(screen.getByRole("button", { name: "Show the numbers" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Genre",
      "Stories",
      "Median",
      "Interquartile range",
      "Median age",
      "Compared with all genres",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    expect(rows[1].lastElementChild.textContent).toBe("▲ Clearly more dialogue");
    expect(rows[3].textContent).toBe("Tiny GenreFewer than 10 stories");
    const explore = screen.getByRole("link", { name: "Open in Explore: dialogue share" }) // starts with its visible words (F76);
    expect(explore.textContent).toBe("Open in Explore →");
    expect(explore.getAttribute("href")).toBe("#/explore?mode=one&genre=romance&var=dlg_word_share&include=all");
    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("columnheader")[2].textContent).toBe("Share"));
  });

  it("announces the heading and the takeaway, again when the order changes", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const live = () => document.querySelector(".genres-page > [aria-live='polite']").textContent;
    await waitFor(() =>
      expect(live()).toMatch(
        /^2 of 2 genres clearly differ from all genres\. ▲ More dialogue: Fetish\. ▼ Less dialogue: Romance\. All genres: median .* Too few stories to compare: Tiny Genre \(fewer than 10\)\.$/,
      ),
    );
    const said = live();
    await user.click(screen.getByRole("radio", { name: "By median" }));
    await waitFor(() => expect(live()).toBe(""));
    await waitFor(() => expect(live()).toBe(said));
  });
});

describe("details wording", () => {
  it("names every number of a genre, for numbers and yes/no characteristics", () => {
    const words = { id: "story_words", unit: "words", more_word: "Longer", less_word: "Shorter", bins: { type: "ranges" } };
    const entry = { k: "num", fmt: "num" };
    const row = { i: 5, genre: { id: "adult-romance", name: "Romance" }, all: false, small: false, f: 0, age: 10.7, stats: { n: 300, p25: 2250, median: 4390, p75: 8150 } };
    const d = rowDetails(row, words, entry, 10);
    expect(d.name).toBe(
      "Romance: median 4,390 words, interquartile range 2,250–8,150, 300 stories, median age 10.7 years, no clear difference from all genres",
    );
    expect(d.line).toBe("median 4,390 words · interquartile range 2,250–8,150 · 300 stories · median age 10.7 years · no clear difference from all genres.");
    expect(rowDetails({ ...row, f: -1 }, words, entry, 10).name).toMatch(/clearly shorter than all genres$/);
    expect(rowDetails({ ...row, stats: null }, words, entry, 10).name).toBe("Romance: fewer than 10 stories");
    const yes = { id: "pov_is_first_person", yes_subject: "First-person stories", bins: { type: "levels" } };
    expect(rowDetails({ ...row, stats: { n: 283, share: 0.72 } }, yes, { k: "bin" }, 10).name).toBe(
      "Romance: 72% first-person stories, 283 stories, median age 10.7 years, no clear difference from all genres",
    );
  });
});

describe("the fixtures meta", () => {
  it("has the rule for How it works", () => {
    expect(fixtureMeta.genre_rule).toEqual({ min_r: 0.2, level: 0.999, min_tvd: 0.2, min_n: 30 });
  });
});
