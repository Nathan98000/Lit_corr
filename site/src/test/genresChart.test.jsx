// The Genres page, one characteristic in every genre (View 1): headings, lists, order, marks, details, the keyboard
// and the actions, for numbers and yes/no characteristics; no story-age note.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { ORDER_GLIDE_MS } from "../components/GenreGlide.jsx";
import { clearCache } from "../lib/data.js";
import {
  allGenresLine,
  chartHeading,
  chartQuestionText,
  comparison,
  directionWords,
  formatPercent,
  genreRows,
  numberFormat,
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
 * and Fetish clearly higher (+0.25); in "has dialogue" Romance clearly more common.
 */
function flaggedFetch() {
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
    expect(chartHeading(rows.filter((r) => r.f).length, 30)).toBe("6 of 30 genres clearly differ from all genres");
    const lists = takeawayLists(rows, v(real, "story_words"), "num");
    expect(lists.map((l) => [l.mark, l.word, l.names])).toEqual([
      // ordered by the size of the difference
      ["▼", "Shorter", ["Reviews & Essays", "How To", "Letters & Transcripts", "Toys & Masturbation", "Humor & Satire", "Anal"]],
    ]);
    // a tie goes A–Z: Anal and Humor & Satire have fewer sentences at r = −0.22 (data update 20261013: word count's
    // tie, Anal and Crossdressing at −0.21, is gone)
    const sentences = genreRows(real, file, "story_sentences");
    expect(takeawayLists(sentences, v(real, "story_sentences"), "num").map((l) => [l.mark, l.word, l.names])).toEqual([
      ["▲", "Higher", ["Novels and Novellas", "Sci-Fi & Fantasy"]],
      ["▼", "Lower", ["Reviews & Essays", "How To", "Letters & Transcripts", "Toys & Masturbation", "Anal", "Humor & Satire"]],
    ]);
    expect(text(allGenresLine(rows, v(real, "story_words"), file.c.story_words))).toBe(
      "All genres: median 3,630 words, interquartile range 2,030–6,420. Genre medians run from 1,270 to 4,930.",
    );
    const first = genreRows(real, file, "pov_is_first_person");
    expect(text(allGenresLine(first, v(real, "pov_is_first_person"), file.c.pov_is_first_person))).toBe(
      "All genres: first-person stories make up 57% of stories. Genres run from 25% to 98%.",
    );
    expect(first.filter((r) => r.f).length).toBe(9);
    expect(genreRows(real, file, "rel_romance_per_1k").filter((r) => r.f).map((r) => r.genre.name)).toEqual(["Romance"]);
  });

  it.skipIf(!real)("ask the approved questions, with the genres as the subject", () => {
    expect(chartQuestionText(v(real, "story_words"))).toBe("How do genres differ in word count?");
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
      "10 of 29 genres clearly differ from all genres",
      "Too few stories to compare: Chain Stories (19).",
    ]);
    expect(say("long", "sex_terms_per_1k")).toEqual([
      "13 of 28 genres clearly differ from all genres",
      "Too few stories to compare: How To (22), Reviews & Essays (22).",
    ]);
    // no genre differs, and two are too few to compare (data update 20261013: All stories' adverbs in speech tags,
    // which said so, now has one genre that differs)
    expect(say("long", "story_pages")).toEqual([
      "No genre clearly differs from all genres",
      "Too few stories to compare: How To (22), Reviews & Essays (22).",
    ]);
    // a genre with fewer than 10 stories with the characteristic: the file has no count for it
    expect(say("long", "dlg_adverb_tag_share")[1]).toBe(
      "Too few stories to compare: How To (fewer than 10), Letters & Transcripts (22), Reviews & Essays (fewer than 10).",
    );
  });

  it.skipIf(!real)("change nothing with All stories, except where missing values leave a genre under 30 stories", () => {
    const file = realFile();
    const changed = Object.keys(file.c).filter((id) => tooFewLine(genreRows(real, file, id), real.min_n));
    expect(changed).toEqual(["dlg_adverb_tag_share"]);
    const adverbs = genreRows(real, file, "dlg_adverb_tag_share");
    expect(adverbs.filter((r) => !r.all && r.stats && !r.small)).toHaveLength(29); // 29 genres compared, one marked
    expect(rowsHeading(adverbs)).toBe("1 of 29 genres clearly differs from all genres");
    expect(tooFewLine(adverbs, real.min_n)).toBe("Too few stories to compare: Reviews & Essays (29).");
    expect(rowsHeading(genreRows(real, file, "sex_first_scene_position"))).toBe("6 of 30 genres clearly differ from all genres");
    expect(rowsHeading(genreRows(real, file, "story_words"))).toBe("6 of 30 genres clearly differ from all genres");
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
    expect(withUnit("3,610", "words")).toBe("3,610 words");
    expect(withUnit("1", "pages")).toBe("1 page");
    expect(withUnit("1", "stories")).toBe("1 story");
    expect(withUnit("1.0", "pages")).toBe("1.0 pages"); // singular only for exactly "1"
    expect(withUnit("0.42", "per 1,000 words")).toBe("0.42 per 1,000 words");
  });

  // one chart's numbers: all genres first ([n, p10, p25, median, p75, p90]), then a genre ([n, p25, median, p75])
  const nf = (fmt, all, unit = "words") =>
    numberFormat({ unit, bins: { type: "ranges" } }, { k: "num", fmt, q: [[900, 0, ...all, 0], [300, 1, 2, 3]] });

  it("print a chart's numbers with one number of decimals, the most of All genres' median and quartiles (F66)", () => {
    const length = nf("num", [2050, 3610, 6320]);
    expect([length.value(3610), length.span(2050, 6320), length.value(5060)]).toEqual(["3,610", "2,050–6,320", "5,060"]);
    const paragraph = nf("num", [31.7, 43, 62.2]);
    expect([paragraph.value(43), paragraph.span(31.7, 62.2), paragraph.value(18), paragraph.value(18.4)]).toEqual([
      "43.0",
      "31.7–62.2",
      "18.0",
      "18.4",
    ]);
    expect(nf("num", [0.227, 0.422, 0.768]).decimals).toBe(3);
    expect(nf("num", [-0.333, -0.1, 0.0588]).decimals).toBe(3); // at most 3
    // two significant digits where the chart's decimals would round a value to 0 or to one digit
    const anatomy = nf("num", [6.5, 10, 15.2]);
    expect(anatomy.decimals).toBe(1);
    expect(anatomy.value(0.0876)).toBe("0.088");
    expect(anatomy.value(0.04)).toBe("0.040");
    const tags = nf("num", [5, 7, 10], "tags");
    expect([tags.value(8.5), tags.value(8), tags.value(12)]).toEqual(["8.5", "8", "12"]); // whole values stay whole
    expect(nf("num", [1, 1, 2], "pages").withUnit(1)).toBe("1 page");
  });

  it("use “−” and “to” where a range has a negative end, and write years whole", () => {
    const tone = nf("num", [-0.333, -0.1, 0.0588], "");
    expect(tone.span(-0.333, 0.0588)).toBe("−0.333 to 0.059");
    expect(tone.value(-0.00794)).toBe("−0.0079"); // three decimals would leave one significant digit
    expect(nf("year", [2008, 2013, 2019]).span(2008, 2019)).toBe("2008–2019");
    expect(nf("year", [2008, 2013, 2019]).value(2013.4)).toBe("2013");
  });

  it("print percentages whole, with one decimal when All genres' median is under 10%, never “0%” above 0", () => {
    const rare = nf("percent", [0.014, 0.023, 0.034]);
    expect([rare.value(0.019), rare.value(0.023), rare.span(0.014, 0.034)]).toEqual(["1.9%", "2.3%", "1.4%–3.4%"]);
    expect(rare.value(0.0004)).toBe("<0.1%");
    expect(rare.value(0)).toBe("0.0%");
    const common = nf("percent", [0.31, 0.45, 0.6]);
    expect([common.value(0.45), common.value(0.004), common.value(0.0002)]).toEqual(["45%", "0.4%", "<0.1%"]);
    const buildUp = nf("percent", [-0.07, 0.005, 0.11]);
    expect(buildUp.span(-0.07, 0.11)).toBe("−7.0% to 11.0%");
  });

  it.skipIf(!real)("print the real data's numbers as one chart (F66)", () => {
    const file = realFile();
    const say = (id) => text(allGenresLine(genreRows(real, file, id), v(real, id), file.c[id]));
    const details = (id, genre) => {
      const row = genreRows(real, file, id).find((r) => r.genre.id === genre);
      return rowDetails(row, v(real, id), file.c[id], real.min_n);
    };
    // rare words: How To no longer prints all genres' "2%"
    expect(say("lex_rare_word_share")).toBe("All genres: median 2.5%, interquartile range 1.7%–3.4%. Genre medians run from 1.6% to 3.7%.");
    // a median of exactly 1 takes the singular, as the rows' names do
    expect(say("story_pages")).toBe("All genres: median 1 page, interquartile range 1–2. Genre medians run from 1 to 2.");
    expect(details("lex_rare_word_share", "adult-how-to").items[0]).toEqual(["Median", "1.8%"]);
    // paragraph length: one number of decimals
    expect(say("story_mean_paragraph_words")).toBe(
      "All genres: median 43.1 words, interquartile range 31.7–62.2. Genre medians run from 36.4 to 65.3.",
    );
    // the build-up of dialogue: minus signs and "to"
    expect(say("pace_dialogue_shift")).toBe("All genres: median 0.9%, interquartile range −6.6% to 11.2%. Genre medians run from −2.8% to 5.9%.");
    // story length: unchanged
    expect(say("story_words")).toBe("All genres: median 3,630 words, interquartile range 2,030–6,420. Genre medians run from 1,270 to 4,930.");
    // unrecognized words: never "0%" for stories with any, in any genre
    const unrecognized = genreRows(real, file, "lex_unrecognized_word_share");
    const words = [say("lex_unrecognized_word_share"), ...unrecognized.map((r) => rowDetails(r, v(real, "lex_unrecognized_word_share"), file.c.lex_unrecognized_word_share, 10).line)];
    for (const w of words) expect(w).not.toMatch(/(^|[^.\d])0%/);
  });

  it("print shares whole, with one decimal under 1%, and “<0.1%” for a share above 0 that would read 0", () => {
    expect(formatPercent(0.553)).toBe("55%");
    expect(formatPercent(0.008)).toBe("0.8%");
    expect(formatPercent(0.001)).toBe("0.1%");
    expect(formatPercent(0.0004)).toBe("<0.1%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("the chart", () => {
  it("hatches the bar of a genre with fewer stories than the rule needs, as a style", async () => {
    await openGenres("#/genres?var=dlg_word_share&include=long"); // Romance: 15 stories
    const hatch = document.querySelector(".genre-chart pattern").id;
    const romance = [...document.querySelectorAll(".genre-chart .row")].find((r) => r.getAttribute("aria-label").startsWith("Romance:"));
    expect(romance.classList.contains("small")).toBe(true);
    expect(romance.querySelector(".iqr").style.fill).toBe(`url("#${hatch}")`);
    const fetish = [...document.querySelectorAll(".genre-chart .row")].find((r) => r.getAttribute("aria-label").startsWith("Fetish:"));
    expect(fetish.querySelector(".iqr").style.fill).toBe("");
  });

  it("draws numbers as ranges and yes/no characteristics as shares, All genres first", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    const chart = document.querySelector(".genre-chart");
    expect(chart.classList.contains("kind-num")).toBe(true);
    expect(chart.querySelectorAll(".iqr").length).toBe(3); // tiny has too few stories
    expect(rowNames()[0]).toMatch(/^All genres: median \d+%, interquartile range/);
    expect(rowNames()[3]).toBe("Tiny Genre: fewer than 10 stories");
    expect(within(chart).getByText("Fewer than 10 stories")).toBeTruthy();
    expect(chart.querySelector(".reflab").textContent).toMatch(/^Median of all genres: \d+%$/); // the dashed line names itself

    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(document.querySelector(".genre-chart.kind-bin")).toBeTruthy());
    expect(document.querySelectorAll(".genre-chart .share-bar").length).toBe(3);
    expect(document.querySelectorAll(".genre-chart .iqr").length).toBe(0);
    expect(heading()).toBe("1 of 2 genres clearly differs from all genres");
    expect(document.querySelector(".genre-list").textContent).toBe("▲ More common: Romance.");
    expect(document.querySelector(".all-line").textContent).toMatch(/^All genres: stories with dialogue make up \d+% of stories\./);
    // a yes/no chart's dashed line is all genres' share, and says so; the key has no entry for it
    expect(document.querySelector(".genre-chart .reflab").textContent).toMatch(/^Share of all genres: \d+%$/);
    expect([...document.querySelectorAll(".genre-legend li")].map((li) => li.textContent.trim())).not.toContain("All genres");
  });

  it("marks and names the genres that clearly differ", async () => {
    await openGenres("#/genres?var=dlg_word_share&sort=az"); // A–Z: Fetish, then Romance
    // the marks in their own column after the names (F61a), the values alone
    const marks = [...document.querySelectorAll(".genre-chart .row")].map((r) => r.querySelector(".gmark")?.textContent ?? "");
    expect(marks).toEqual(["", "▲", "▼", ""]); // All genres, Fetish, Romance, Tiny Genre
    const values = [...document.querySelectorAll(".genre-chart .gval")].map((t) => t.textContent);
    expect(values.slice(0, 3).every((v) => /^\d+%$/.test(v))).toBe(true);
    expect(rowNames()[1]).toMatch(
      /^Fetish: median \d+%, interquartile range \d+%–\d+%, 150 stories, clearly more dialogue than all genres$/,
    );
    expect(rowNames()[2]).toMatch(/, clearly less dialogue than all genres$/);
  });

  it("orders the genres by median by default, or by share, with All genres first and ties A–Z; A–Z on request (the owner, 2026-10-13)", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const order = () => rowNames().map((n) => n.split(":")[0]);
    const file = fixtureFile("genres/all.json");
    const meds = { Fetish: file.c.dlg_word_share.q[1][2], Romance: file.c.dlg_word_share.q[2][2] };
    const expected = ["Fetish", "Romance"].sort((a, b) => meds[b] - meds[a]);
    expect(order()).toEqual(["All genres", ...expected, "Tiny Genre"]); // too few stories: last
    expect(screen.getByRole("radio", { name: "By median" }).checked).toBe(true);
    expect(window.location.hash).toBe("#/genres?var=dlg_word_share"); // the default needs no setting in the address
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=all&sort=az"));
    expect(order()).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]);
    // yes/no: "By share"; named groups: no order to choose
    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(screen.getByRole("radio", { name: "By share" }).checked).toBe(true));
    window.location.hash = "#/genres?var=pov_class&sort=az";
    await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "Order" })).toBeNull());
    expect(window.location.hash).toBe("#/genres?var=pov_class&sort=az"); // the address is read, then sanitized
    // an old link to "By median" (sort=value, the default since) opens in that order
    window.location.hash = "#/genres?var=dlg_word_share&sort=value";
    await waitFor(() => expect(screen.getByRole("radio", { name: "By median" }).checked).toBe(true));
    expect(order()).toEqual(["All genres", ...expected, "Tiny Genre"]);
    const rows = [{ all: true, i: 0 }, { i: 1, stats: { median: 2 } }, { i: 2, stats: { median: 5 } }, { i: 3, stats: { median: 2 } }, { i: 4, stats: null }];
    expect(orderRows(rows, "num", undefined).map((r) => r.i)).toEqual([0, 2, 1, 3, 4]);
    expect(orderRows(rows, "num", "value").map((r) => r.i)).toEqual([0, 2, 1, 3, 4]);
    expect(orderRows(rows, "num", "az")).toBe(rows);
    expect(orderRows(rows, "grp", undefined)).toBe(rows); // named groups and bands: always A–Z
  });

  it("says the order on a line of its own between the legend and the chart, with the toggle at its right (F75)", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const line = () => document.querySelector(".order-line");
    expect(line().querySelector(".order-words").textContent).toBe("Genres by median, highest first"); // the default
    expect(line().querySelector("[role=radiogroup]").getAttribute("aria-label")).toBe("Order");
    expect(document.querySelector(".genres-controls [role=radiogroup][aria-label='Order']")).toBeNull(); // not in the controls
    // between the legend and the chart
    expect(line().previousElementSibling.classList.contains("genre-legend")).toBe(true);
    expect(line().nextElementSibling.classList.contains("genre-chart")).toBe(true);
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(line().querySelector(".order-words").textContent).toBe("Genres in alphabetical order"));
    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(line().querySelector(".order-words").textContent).toBe("Genres by share, highest first"));
    window.location.hash = "#/genres?var=emo_anger_per_1k";
    await waitFor(() => expect(line().querySelector(".order-words").textContent).toBe("Genres by share with any, highest first"));
    // named groups: the line without a toggle
    window.location.hash = "#/genres?var=pov_class";
    await waitFor(() => expect(line().querySelector(".order-words").textContent).toBe("Genres in alphabetical order"));
    expect(line().querySelector("[role=radiogroup]")).toBeNull();
    const css = readFileSync(path.join(here, "..", "genres.css"), "utf8");
    expect(css).toMatch(/\.segmented\.compact label \{[^}]*min-height: 36px;/);
    expect(css).toMatch(/\.segmented\.compact label::after \{[^}]*inset: -4px 0;/); // a 44 px target
  });

  it("heads the value column like the Stories column: Median, or Share (F74)", async () => {
    await openGenres("#/genres?var=dlg_word_share");
    const heads = () => [...document.querySelectorAll(".genre-chart .col-head, .genre-chart .stories-head")].map((t) => t.textContent);
    expect(heads()).toEqual(["Median", "Stories"]);
    window.location.hash = "#/genres?var=dlg_has_dialogue";
    await waitFor(() => expect(heads()).toEqual(["Share", "Stories"]));
  });

  it("glides the rows to their new places when the order changes, and only then (I10)", async () => {
    const frames = [];
    vi.stubGlobal("requestAnimationFrame", (f) => frames.push(f) && frames.length);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const user = await openGenres("#/genres?var=dlg_word_share");
    const moved = () => [...document.querySelectorAll(".genre-chart [data-glide]")].filter((el) => el.getAttribute("transform"));
    expect(moved()).toHaveLength(0);
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(window.location.hash).toMatch(/sort=az/));
    const file = fixtureFile("genres/all.json");
    const swapped = file.c.dlg_word_share.q[2][2] > file.c.dlg_word_share.q[1][2]; // Romance's median above Fetish's
    if (swapped) {
      expect(moved().length).toBeGreaterThan(0); // drawn at their old places first
      expect(moved()[0].getAttribute("transform")).toMatch(/^translate\(0 -?\d+(\.\d)?\)$/);
      let t = 0;
      while (frames.length) frames.shift()((t += 100));
      expect(moved()).toHaveLength(0); // at their new places after 300 ms
    }
    // reduced motion: the rows jump
    vi.stubGlobal("matchMedia", (q) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    await user.click(screen.getByRole("radio", { name: "By median" }));
    await waitFor(() => expect(window.location.hash).not.toMatch(/sort=/));
    expect(moved()).toHaveLength(0);
  });

  it("ends a glide with every row at its place even when no animation frame comes, and jumps in a hidden tab (the owner's change 7)", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1); // a tab left during the glide: the frames never come
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const user = await openGenres("#/genres?var=dlg_word_share");
    const moved = () => [...document.querySelectorAll(".genre-chart [data-glide]")].filter((el) => el.getAttribute("transform"));
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(window.location.hash).toMatch(/sort=az/));
    expect(moved().length).toBeGreaterThan(0); // drawn at their old places first (the test data's Fetish and Romance swap)
    await new Promise((r) => setTimeout(r, ORDER_GLIDE_MS + 300));
    expect(moved()).toHaveLength(0); // at their new places all the same
    // a tab that isn't on screen: the rows jump to their places
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    try {
      await user.click(screen.getByRole("radio", { name: "By median" }));
      await waitFor(() => expect(window.location.hash).not.toMatch(/sort=/));
      expect(moved()).toHaveLength(0);
    } finally {
      delete document.hidden;
    }
  });

  it("stops a glide under way when the order changes again, leaving no row out of its place", async () => {
    const pending = new Map();
    let next = 0;
    vi.stubGlobal("requestAnimationFrame", (f) => {
      next += 1;
      pending.set(next, f);
      return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (k) => pending.delete(k));
    const user = await openGenres("#/genres?var=dlg_word_share");
    const moved = () => [...document.querySelectorAll(".genre-chart [data-glide]")].filter((el) => el.getAttribute("transform"));
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(window.location.hash).toMatch(/sort=az/));
    expect(moved().length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: "By median" })); // before the first glide's frames
    await waitFor(() => expect(window.location.hash).not.toMatch(/sort=/));
    let t = 0;
    while (pending.size) {
      const [k, f] = [...pending][0];
      pending.delete(k);
      f((t += 100));
    }
    expect(moved()).toHaveLength(0);
  });

  it("puts a mostly-zero characteristic's genres in order of their share with any, as its switch says (the owner's change 7)", async () => {
    // the test data's Fetish and Romance both have half their stories with any: give Romance 80%, and keep their
    // medians among those with any the same, so that only the share decides
    const serve = flaggedFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).split("?")[0].endsWith("genres/all.json")) return res;
      const body = await res.json();
      const z = body.c.emo_anger_per_1k.z;
      z[2] = [96, ...z[2].slice(1)]; // Romance: 96 of its 120 stories with any
      return { ok: true, status: 200, json: async () => body };
    });
    const user = await openGenres("#/genres?var=emo_anger_per_1k");
    const rows = () => [...document.querySelectorAll(".genre-any .row")];
    const order = () => rows().map((r) => r.getAttribute("aria-label").split(":")[0]);
    const tops = () => rows().map((r) => Number(r.querySelector(".glabel").getAttribute("y")));
    expect(screen.getByRole("radio", { name: "By share with any" }).checked).toBe(true);
    expect(order()).toEqual(["All genres", "Romance", "Fetish", "Tiny Genre"]); // 80%, then 50%; too few stories: last
    expect(tops()).toEqual([...tops()].sort((a, b) => a - b)); // drawn from the top in that order
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(order()).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre"]));
    await user.click(screen.getByRole("radio", { name: "By share with any" }));
    await waitFor(() => expect(order()).toEqual(["All genres", "Romance", "Fetish", "Tiny Genre"]));
  });

  it.skipIf(!real)("orders every real mostly-zero characteristic by its share with any, in every option", () => {
    let charts = 0;
    for (const s of real.subsets) {
      const file = realFile(s.id);
      for (const [id, entry] of Object.entries(file.c)) {
        if (entry.k !== "zero") continue;
        const [, ...rest] = orderRows(genreRows(real, file, id), "zero", undefined);
        const shares = rest.map((r) => (r.stats ? r.stats.share : null));
        const shown = shares.filter((x) => x != null);
        expect(shown, `${s.id} ${id}`).toEqual([...shown].sort((a, b) => b - a));
        expect(shares.slice(shown.length).every((x) => x == null), `${s.id} ${id}`).toBe(true); // too few: last
        charts += 1;
      }
    }
    expect(charts).toBeGreaterThan(100);
  });
});

describe("no story-age note (decision 3)", () => {
  it("is left out in any option, and the files have no median age (O18)", async () => {
    expect(fixtureFile("genres/all.json")).not.toHaveProperty("age");
    const user = await openGenres("#/genres?var=dlg_word_share");
    const noNote = () => {
      expect(document.querySelector(".genre-age, .agebox")).toBeNull();
      expect(document.querySelector(".genres-page").textContent).not.toMatch(/Story age|median ages?/);
      expect(screen.queryByRole("button", { name: /^Compare stories/ })).toBeNull();
    };
    noNote();
    await user.selectOptions(screen.getByLabelText("Only include"), "y2020");
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&include=y2020"));
    await waitFor(() => expect(document.querySelector(".genres-page .chart-panel[aria-busy='false']")).toBeTruthy());
    noNote();
  });
});

describe("details and the keyboard", () => {
  it("is one tab stop; arrows, Home and End move; the card holds the numbers and the link to the genre", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share&sort=az"); // A–Z: Fetish, then Romance
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    expect(rows.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    rows[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[1]);
    const card = document.querySelector(".genre-tip");
    expect(card.querySelector("strong").textContent).toBe("Fetish");
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Median", "Interquartile range", "Stories"]);
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
    const user = await openGenres("#/genres?var=dlg_word_share&sort=az");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    fireEvent.click(rows[2]); // a tap keeps the card
    await user.click(within(document.querySelector(".genre-tip")).getByRole("link"));
    await waitFor(() => expect(window.location.hash).toBe("#/genres?view=genre&genre=romance&include=all"));
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/genres?var=dlg_word_share&sort=az"));
  });

  it("shows a line under the chart on phones, with the link, and “Tap again to close.” after a tap", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 343, height: 0, top: 0, left: 0, right: 343, bottom: 0 });
    await openGenres("#/genres?var=dlg_word_share&sort=az");
    const rows = [...document.querySelectorAll(".genre-chart .row")];
    expect(document.querySelector(".genre-chart").classList.contains("mode-side")).toBe(true); // labels beside the bars
    fireEvent.click(rows[2]);
    const line = document.querySelector(".genre-line");
    expect(line.textContent).toMatch(
      /^Romance median \d+% · interquartile range \d+%–\d+% · 120 stories · clearly less dialogue than all genres\. What stands out about stories in Romance\? → Tap again to close\.$/,
    );
    expect(line.querySelector("[aria-live]").textContent).toMatch(/^Romance median/);
    expect(document.querySelector(".genre-tip")).toBeNull();
    fireEvent.click(rows[2]);
    expect(document.querySelector(".genre-line").textContent).toBe("");
  });
});

describe("the actions and what screen readers hear", () => {
  it("open the characteristic in Explore, for All genres, from the line under the chart (round 4's I15)", async () => {
    await openGenres("#/genres?var=dlg_word_share&include=y2020");
    const explore = screen.getByRole("link", { name: "Dialogue share with popularity" }); // its visible words in its name
    expect(explore.textContent).toBe("With popularity\u00a0→");
    expect(explore.getAttribute("href")).toBe("#/explore?genre=all&var=dlg_word_share&include=y2020");
    expect(screen.queryByRole("link", { name: /^Open in Explore/ })).toBeNull();
  });

  it("announces the heading and the takeaway, and only the order's words when the order changes (F75)", async () => {
    const user = await openGenres("#/genres?var=dlg_word_share");
    const live = () => document.querySelector(".genres-page > [aria-live='polite']").textContent;
    await waitFor(() =>
      expect(live()).toMatch(
        /^2 of 2 genres clearly differ from all genres\. ▲ More dialogue: Fetish\. ▼ Less dialogue: Romance\. All genres: median .* Too few stories to compare: Tiny Genre \(fewer than 10\)\.$/,
      ),
    );
    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    await waitFor(() => expect(live()).toBe("Genres in alphabetical order."));
    await user.click(screen.getByRole("radio", { name: "By median" }));
    await waitFor(() => expect(live()).toBe("Genres by median, highest first."));
  });
});

describe("details wording", () => {
  it("names every number of a genre, for numbers and yes/no characteristics", () => {
    const words = { id: "story_words", unit: "words", more_word: "Longer", less_word: "Shorter", bins: { type: "ranges" } };
    const entry = { k: "num", fmt: "num", q: [[8987, 1270, 2050, 3610, 6320, 10900]] }; // all genres' numbers set the decimals
    const row = { i: 5, genre: { id: "adult-romance", name: "Romance" }, all: false, small: false, f: 0, stats: { n: 300, p25: 2250, median: 4390, p75: 8150 } };
    const d = rowDetails(row, words, entry, 10);
    expect(d.name).toBe("Romance: median 4,390 words, interquartile range 2,250–8,150, 300 stories, no clear difference from all genres");
    expect(d.line).toBe("median 4,390 words · interquartile range 2,250–8,150 · 300 stories · no clear difference from all genres.");
    expect(d.items).toEqual([
      ["Median", "4,390 words"],
      ["Interquartile range", "2,250–8,150"],
      ["Stories", "300"],
    ]);
    expect(rowDetails({ ...row, f: -1 }, words, entry, 10).name).toMatch(/clearly shorter than all genres$/);
    expect(rowDetails({ ...row, stats: null }, words, entry, 10).name).toBe("Romance: fewer than 10 stories");
    const yes = { id: "pov_is_first_person", yes_subject: "First-person stories", bins: { type: "levels" } };
    expect(rowDetails({ ...row, stats: { n: 283, share: 0.72 } }, yes, { k: "bin", q: [[8447, 0.571]] }, 10).name).toBe(
      "Romance: 72% first-person stories, 283 stories, no clear difference from all genres",
    );
  });
});

describe("the fixtures meta", () => {
  it("has the rule for How it works", () => {
    expect(fixtureMeta.genre_rule).toEqual({ min_r: 0.2, level: 0.999, min_tvd: 0.2, min_n: 30 });
  });
});
