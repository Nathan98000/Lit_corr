// The Trends page's review (STAGE2_TRENDS_REVIEW_IMPLEMENTATION_PROMPT.md): the site-wide fixes and the wording
// (phase 2). The layouts that jsdom can't measure (the kicker's lines, the footer's page list, the space above the
// footer) are checked in a browser by the review's scripts; here, the structure that makes them work.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { downloadChartImage, listsImagePlan } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import CharacteristicPicker from "../components/CharacteristicPicker.jsx";
import { tickDrop } from "../components/ComparisonProfile.jsx";
import IncludeSelect from "../components/IncludeSelect.jsx";
import TrendChart from "../components/TrendChart.jsx";
import { TrendLegend } from "../components/TrendAnswer.jsx";
import { plotHeight, trendLayout, trendOverlaps } from "../lib/trendLayout.js";
import {
  bandsLine,
  changesHeading,
  changesQuestion,
  changesRowName,
  changesSampleLine,
  changesScale,
  changesValues,
  lengthLine,
  notClearInBands,
  overTimeCharacteristic,
  pathLine,
  pickerChanges,
  trendProfile,
  trendChartInput,
  trendFormat,
  trendQuestion,
  trendQuestionText,
  windowNumbers,
} from "../lib/trends.js";
import { onTrendsPage } from "../lib/urlState.js";
import { changedOverTime } from "../lib/wording.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

vi.mock("../lib/chartImage.js", async (original) => ({ ...(await original()), downloadChartImage: vi.fn(async () => {}) }));

const here = path.dirname(fileURLToPath(import.meta.url));
const realTrends = (sub, g) =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "trends", sub, `${g}.json`), "utf8"));
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8");
const trendsCss = readFileSync(path.join(here, "..", "trends.css"), "utf8");
const real = realMeta();
const ALL = { id: "all", name: "All genres" };
const ROMANCE = { id: "adult-romance", name: "Romance" };

/** The fixture's meta, with dialogue share's noun made plural ("dialogue lines"), as a characteristic's can be. */
const pluralMeta = {
  ...fixtureMeta,
  variables: fixtureMeta.variables.map((v) => (v.id === "dlg_word_share" ? { ...v, noun: "dialogue lines", plural: true } : v)),
};

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens an address with the fixture's data (or `meta` instead of its meta.json) and waits for the answer. */
async function open(hash, { meta = null, ready = ".chart-panel[aria-busy='false']" } = {}) {
  if (meta) {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) =>
      String(url).endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url),
    );
  }
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
  return user;
}

/** The question as it reads on screen: the selects show their chosen option, hidden words aside. */
function question() {
  const p = document.querySelector("#question .sentence").cloneNode(true);
  for (const el of p.querySelectorAll("select, .visually-hidden")) el.remove();
  return p.textContent.replace(/⁠/g, "");
}

describe("has or have (phase 2)", () => {
  it("asks how a plural noun has changed with “have”, and the share of a yes/no characteristic with “has”", () => {
    const paragraphs = { id: "story_long_paragraph_share", noun: "very long paragraphs", plural: true, bins: { type: "ranges" } };
    const pages = { id: "story_pages", noun: "the number of pages", bins: { type: "ranges" } };
    const continuation = { id: "end_to_be_continued", noun: "announces a continuation", yes_subject: "Stories that announce a continuation" };
    expect(trendQuestionText(paragraphs, ALL)).toBe("Across all genres, how have very long paragraphs changed over time?");
    expect(trendQuestionText(pages, ROMANCE)).toBe("In Romance, how has the number of pages changed over time?");
    expect(trendQuestionText(continuation, ALL)).toBe(
      "Across all genres, how has the share of stories that announce a continuation changed over time?",
    );
    expect(trendQuestion(paragraphs, ALL)).toEqual({ before: "Across ", middle: ", how have ", slot: "very long paragraphs", after: " changed over time" });
    // Explore's "Keep exploring" item agrees
    expect(changedOverTime(paragraphs)).toBe("How have very long paragraphs changed over time?");
    expect(changedOverTime(pages)).toBe("How has the number of pages changed over time?");
    expect(changedOverTime(continuation)).toBe("How has the share of stories that announce a continuation changed over time?");
  });

  it.skipIf(!real)("never puts “has” before a plural noun, for every Trends characteristic in the real meta.json", () => {
    const shown = real.variables.filter(onTrendsPage);
    expect(shown).toHaveLength(180);
    let plural = 0;
    for (const v of shown) {
      const verb = v.plural && !v.yes_subject ? "have" : "has";
      plural += verb === "have";
      for (const genre of [ALL, ROMANCE]) {
        const q = trendQuestionText(v, genre);
        expect(q, v.id).toMatch(new RegExp(`^(Across all genres|In Romance), how ${verb} `));
        if (v.plural) expect(q, v.id).not.toContain(`how has ${v.noun}`);
      }
      expect(changedOverTime(v), v.id).toMatch(new RegExp(`^How ${verb} `));
    }
    expect(plural).toBe(78);
    const byId = (id) => shown.find((v) => v.id === id);
    expect(changedOverTime(byId("punct_comma_per_1k"))).toBe("How have commas changed over time?");
    expect(changedOverTime(byId("pace_action_peak_position"))).toBe("How has where action verbs peak changed over time?");
    expect(trendQuestionText(byId("sex_scenes_per_10k"), ALL)).toBe(
      "Across all genres, how have sex scenes per 10,000 words changed over time?",
    );
  });

  it("follows the question in the tab's title, and in Explore's “Keep exploring” item", async () => {
    await open("#/trends?var=dlg_word_share", { meta: pluralMeta, ready: ".trends-page .chart-panel[aria-busy='false']" });
    expect(question()).toBe("Across all genres, how have dialogue lines changed over time?");
    await waitFor(() => expect(document.title).toBe("Across all genres, how have dialogue lines changed over time?"));
    const region = document.querySelector(".trends-page p.visually-hidden[aria-live='polite']");
    await waitFor(() => expect(region.textContent).toMatch(/^Across all genres, how have dialogue lines changed over time\? /));
  });

  it("words Explore's item with “have” for a plural noun", async () => {
    await open("#/explore?var=dlg_word_share", { meta: pluralMeta });
    const nav = await screen.findByRole("navigation", { name: "Keep exploring" });
    const texts = within(nav).getAllByRole("link").map((a) => a.textContent);
    expect(texts).toContain("How have dialogue lines changed over time?\u00a0→");
  });
});

describe("across all genres, in a genre (phase 2)", () => {
  it("asks both questions across all genres, or in a genre, and the tab's title follows", async () => {
    await open("#/trends?var=dlg_word_share", { ready: ".trends-page .chart-panel[aria-busy='false']" });
    expect(question()).toBe("Across all genres, how has dialogue share changed over time?");
    await waitFor(() => expect(document.title).toBe("Across all genres, how has dialogue share changed over time?"));
    // the slot says "all genres" in lower case; its option keeps "All genres"
    const select = screen.getByLabelText("Genre");
    expect(select.closest(".inline-select").querySelector(".slot-text").textContent).toBe("all genres");
    expect(select.options[0].textContent).toBe("All genres");
    window.location.hash = "#/trends?var=dlg_word_share&genre=romance";
    await waitFor(() => expect(question()).toBe("In Romance, how has dialogue share changed over time?"));
    await waitFor(() => expect(document.title).toBe("In Romance, how has dialogue share changed over time?"));
    window.location.hash = "#/trends?view=changes&genre=all";
    await waitFor(() => expect(question()).toBe("What has changed in stories across all genres?"));
    await waitFor(() => expect(document.title).toBe("What has changed in stories across all genres?"));
    window.location.hash = "#/trends?view=changes&genre=romance";
    await waitFor(() => expect(question()).toBe("What has changed in stories in Romance?"));
    await waitFor(() => expect(document.title).toBe("What has changed in stories in Romance?"));
  });

  it("drops the genre from View 1's takeaway and ends View 2's sample line across all genres or in the genre", async () => {
    await open("#/trends?var=dlg_word_share&genre=romance", { ready: ".trends-page .chart-panel[aria-busy='false']" });
    expect(document.querySelector(".trend-takeaway p").textContent).toMatch(/^Median /);
    expect(changesQuestion(ALL)).toBe("What has changed in stories across all genres?");
    expect(changesQuestion(ROMANCE)).toBe("What has changed in stories in Romance?");
    const file = { then: [2000, 2009], now: [2020, 2026], periods: [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]], n: [1, 2, 3, 4, 5] };
    expect(changesSampleLine(file, ALL, { id: "all" })).toBe("3 stories from 2000–2009 and 5 from 2020 or later across all genres.");
    expect(changesSampleLine(file, ROMANCE, { id: "all" })).toBe("3 stories from 2000–2009 and 5 from 2020 or later in Romance.");
    expect(changesSampleLine(file, ROMANCE, { id: "short", label: "Under 2,000 words" })).toBe(
      "3 stories from 2000–2009 and 5 from 2020 or later in Romance match “Under 2,000 words”.",
    );
  });
});

describe("the kicker and the footer, site-wide (phase 2)", () => {
  it("leads each piece of the kicker with its separator, so one at a line's start can be clipped", async () => {
    await open("#/trends?var=dlg_word_share", { ready: ".trends-page .chart-panel[aria-busy='false']" });
    const kicker = document.querySelector(".kicker");
    expect(kicker.textContent).toBe("How have the stories changed? · 278 stories · 2000–2026");
    expect([...kicker.children].map((el) => el.className)).toEqual(["kicker-title", "kicker-counts"]);
    const counts = kicker.querySelector(".kicker-counts");
    expect(counts.firstElementChild.className).toBe("kicker-sep");
    const pieces = [...counts.querySelectorAll(".kicker-piece")];
    expect(pieces.map((p) => p.textContent)).toEqual(["278 stories", " · 2000–2026"]);
    expect(pieces[1].firstElementChild.className).toBe("kicker-sep");
    // the clipping: a separator is pulled back by its own width, and the boxes that hold the pieces clip
    expect(styles).toMatch(/\.kicker \{[^}]*overflow: hidden;/);
    expect(styles).toMatch(/\.kicker-counts \{[^}]*margin-left: calc\(-1 \* var\(--kicker-sep\)\);/);
    expect(styles).toMatch(/\.kicker-pieces \{[^}]*overflow: hidden;/);
    expect(styles).toMatch(/\.kicker-piece \+ \.kicker-piece \{\s*margin-left: calc\(-1 \* var\(--kicker-sep\)\);/);
    expect(styles).toMatch(/\.kicker-piece \{\s*white-space: nowrap;/);
  });

  it("leaves space above the footer in one place, and lets the page list wrap in balanced lines", () => {
    expect(styles).toMatch(/main\.wrap \{[^}]*min-height: 100vh;[^}]*padding-bottom: 64px;/);
    expect(styles).toMatch(/@media \(max-width: 760px\) \{[^@]*main\.wrap \{\s*padding-bottom: 48px;/);
    expect(styles).toMatch(/\.footer-pages \{[^}]*text-wrap: balance;/);
  });
});

describe("the default view, the switch and the actions (phase 3)", () => {
  const trends = ".trends-page .chart-panel[aria-busy='false']";
  const switchLabels = () => [...document.querySelectorAll(".view-switch label")].map((l) => l.textContent);

  it("opens what changed without a characteristic, and one characteristic with one; the trends page build's addresses still work", async () => {
    await open("#/trends", { ready: trends });
    expect(document.querySelector(".trend-changes")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "All changes" }).checked).toBe(true);
    expect(screen.getByLabelText("Genre").value).toBe("all");
    expect(screen.getByLabelText("Only include").value).toBe("all");
    expect(window.location.hash).toBe("#/trends"); // left as it is
    window.location.hash = "#/trends?genre=romance&include=medium";
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("romance"));
    expect(document.querySelector(".trend-changes, .trends-page .chart-panel")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "All changes" }).checked).toBe(true);
    expect(screen.getByLabelText("Only include").value).toBe("medium");
    window.location.hash = "#/trends?var=pov_class&genre=romance&include=all";
    await waitFor(() => expect(screen.getByRole("radio", { name: "One characteristic" }).checked).toBe(true));
    window.location.hash = "#/trends?view=changes&genre=fetish&include=all"; // as the trends page build wrote it
    await waitFor(() => expect(screen.getByRole("radio", { name: "All changes" }).checked).toBe(true));
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("fetish"));
  });

  it("reads “All changes” then “One characteristic”, and opens the first characteristic when none is remembered", async () => {
    const user = await open("#/trends?genre=romance", { ready: trends });
    expect(switchLabels()).toEqual(["All changes", "One characteristic"]);
    expect(screen.getByRole("radiogroup", { name: "Show" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "One characteristic" }));
    // story length on the real data; the test data's first characteristic stands in for it
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=dlg_word_share&genre=romance&include=all"));
  });

  it("writes what changed without `view`, and returns the masthead's link to the last Trends address", async () => {
    const user = await open("#/trends?var=pov_class", { ready: trends });
    await user.click(screen.getByRole("radio", { name: "All changes" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=all&include=all"));
    await user.selectOptions(screen.getByLabelText("Genre"), "fetish");
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=fetish&include=all"));
    const masthead = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", { name: "Trends" });
    expect(masthead.getAttribute("href")).toBe("#/trends?genre=fetish&include=all");
    const footer = within(screen.getByRole("navigation", { name: "All pages" })).getByRole("link", { name: "Trends" });
    expect(footer.getAttribute("href")).toBe("#/trends?genre=fetish&include=all");
    // back to one characteristic: the one it came from
    await user.click(screen.getByRole("radio", { name: "One characteristic" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=pov_class&genre=fetish&include=all"));
  });

  it("makes “See all changes →” View 1's primary action, a new history entry to what changed in the same genre and option", async () => {
    const user = await open("#/trends?var=pov_class&genre=romance&include=medium", { ready: trends });
    const actions = document.querySelector(".trend-answer .chart-actions");
    expect([...actions.querySelectorAll("a, button")].map((el) => el.textContent)).toEqual([
      "See all changes →",
      "Compare genres →",
      "Download PNG",
    ]);
    const see = screen.getByRole("link", { name: "See all changes in Romance" });
    expect(see.className).toBe("btn primary");
    expect(see.getAttribute("href")).toBe("#/trends?genre=romance&include=medium");
    expect(screen.getByRole("link", { name: /^Compare genres/ }).className).toBe("btn"); // secondary
    const length = window.history.length;
    await user.click(see);
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=romance&include=medium"));
    expect(window.history.length).toBe(length + 1);
    await waitFor(() => expect(document.querySelector(".trend-changes")).toBeTruthy());
    await waitFor(() => expect(document.activeElement.id).toBe("question"));
    window.location.hash = "#/trends?var=pov_class";
    await waitFor(() => expect(screen.getByRole("link", { name: "See all changes in all genres" })).toBeTruthy());
  });

  it("has no Copy link anywhere on the site (O2)", async () => {
    for (const [hash, ready] of [
      ["#/trends", trends],
      ["#/trends?var=dlg_word_share", trends],
      ["#/genres?view=genre&genre=romance&include=all", ".genres-page .chart-panel[aria-busy='false']"],
      ["#/genres?var=dlg_word_share", ".genres-page .chart-panel[aria-busy='false']"],
      ["#/explore?var=dlg_word_share", ".chart-panel[aria-busy='false']"],
      ["#/patterns?genre=all&metric=pop_views", ".patterns-page"],
    ]) {
      clearCache();
      window.history.replaceState(null, "", `/${hash}`);
      const { unmount } = render(<App />);
      await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
      expect(screen.queryByRole("button", { name: /Copy link|Link copied/ }), hash).toBeNull();
      expect(document.querySelector(".copy-link"), hash).toBeNull();
      unmount();
    }
    expect(styles).not.toMatch(/copy-link|copy-manual/);
  });
});

describe("View 1's chart tells the same story as its verdict (phase 4)", () => {
  const FILE = {
    g: "all",
    s: "all",
    rule: { min_r: 0.2, z: 3.29, min_tvd: 0.2, min_n: 30 },
    periods: [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
    then: [2000, 2009],
    now: [2020, 2026],
    n: [901, 1657, 1522, 1564, 3343],
  };
  const WORDS = { id: "story_words", label: "Word count", noun: "story length in words", unit: "words", bins: { type: "ranges" } };
  const CONT = { id: "end_to_be_continued", label: "Announces a continuation", noun: "announces a continuation", unit: "yes/no", yes_subject: "Stories that announce a continuation", bins: { type: "levels" } };
  // the real data's story length and continuation, All genres, All stories
  const length = { k: "num", fmt: "num", q: [[901, 1640, 2500, 4220], [1657, 1740, 3010, 5110], [1522, 1940, 3260, 6000], [1564, 2340, 4060, 7200], [3343, 2310, 4100, 7210]], t: [2558, 1680, 2810, 4760], r: 0.25, f: 1, rm: 0.246, fm: 1 };
  const cont = { k: "bin", q: [[901, 0.112], [1657, 0.075], [1522, 0.052], [1564, 0.081], [3343, 0.091]], t: [2558, 0.089], r: 0.002, f: 0, rm: 0.004, fm: 0 };
  const fmt = (variable, entry) => trendFormat(variable, entry, true, 30);

  it("puts each window's pooled number on its bracket: median, share, share with any, median among those", () => {
    expect(windowNumbers({ entry: length, file: FILE, fmt: fmt(WORDS, length) })).toEqual({ then: "median 2,810", now: "median 4,100" });
    expect(windowNumbers({ entry: cont, file: FILE, fmt: fmt(CONT, cont) })).toEqual({ then: "9%", now: "9%" });
    const consent = { k: "zero", fmt: "num", q: [null, null, null, null, [3346, 700, 0.21, 0.098, 0.196, 0.395]], t: [2561, 233, 0.11, 0.144, 0.229, 0.388], r: 0.092, f: 0 };
    const unit = { id: "rel_consent_per_1k", label: "Consent", noun: "consent language", unit: "per 1,000 words", bins: { type: "ranges" } };
    expect(windowNumbers({ entry: consent, file: FILE, fmt: fmt(unit, consent), kind: "any" })).toEqual({ then: "11% with any", now: "21% with any" });
    expect(windowNumbers({ entry: consent, file: FILE, fmt: fmt(unit, consent), kind: "among" })).toEqual({ then: "median 0.229", now: "median 0.196" });
    // named groups and bands keep their words; nothing when the windows weren't compared
    expect(windowNumbers({ entry: { k: "grp", q: [], t: [9], r: 0.02, f: 0 }, file: FILE, fmt: null })).toBeNull();
    expect(windowNumbers({ entry: { ...length, r: null }, file: FILE, fmt: fmt(WORDS, length) })).toBeNull();
  });

  it("writes a bracket's number on its line where the labels fit side by side, else on a second line under the window", () => {
    const input = trendChartInput(fixtureMeta, WORDS, length, FILE);
    const wide = trendLayout({ width: 736, ...input });
    expect(wide.twoLines).toBe(false);
    expect(wide.brackets.map((b) => b.lines.map((l) => l.text))).toEqual([["2000–2009 · median 2,810"], ["2020 or later · median 4,100"]]);
    for (const width of [288, 343]) {
      const narrow = trendLayout({ width, ...input });
      expect(narrow.twoLines).toBe(true);
      expect(narrow.brackets.map((b) => b.lines.map((l) => l.text))).toEqual([
        ["2000–2009", "median 2,810"],
        ["2020 or later", "median 4,100"],
      ]);
      expect(narrow.height).toBe(trendLayout({ width, ...input, windowValues: null }).height + 15);
    }
    for (const width of [288, 343, 375, 736, 760]) expect(trendOverlaps(trendLayout({ width, ...input })), `${width}`).toEqual([]);
  });

  it("sets a bracket's lines against the chart's edge where centered they would reach it, all of them alike", () => {
    // found by the glyph boxes (phase 8): centered and clamped by textWidth's estimate, "median 54%" ended 1 px past the
    // chart at 375 px in the site's font, and up to 7 px past in Verdana
    const input = trendChartInput(fixtureMeta, WORDS, length, FILE);
    const anchors = (layout) => layout.brackets.map((b) => b.lines.map((l) => l.anchor));
    expect(anchors(trendLayout({ width: 343, ...input }))).toEqual([["middle", "middle"], ["end", "end"]]);
    expect(trendLayout({ width: 343, ...input }).brackets[1].lines.map((l) => l.x)).toEqual([342, 342]);
    expect(anchors(trendLayout({ width: 736, ...input }))).toEqual([["middle"], ["end"]]);
    for (const width of [288, 320, 343, 375, 600, 736, 760]) {
      const layout = trendLayout({ width, ...input });
      for (const b of layout.brackets) {
        expect(new Set(b.lines.map((l) => l.anchor)).size).toBe(1);
        for (const l of b.lines) {
          if (l.anchor === "middle") expect(l.x0 >= 1 && l.x1 <= width - 1, `${width} ${l.text}`).toBe(true);
          else expect(l.x).toBe(l.anchor === "end" ? width - 1 : 1);
        }
      }
    }
  });

  it("marks the periods outside both windows and puts “not compared” between the brackets, under them", () => {
    const layout = trendLayout({ width: 343, ...trendChartInput(fixtureMeta, WORDS, length, FILE) });
    expect(layout.columns.map((c) => c.middle)).toEqual([false, false, true, true, false]);
    const nc = layout.notCompared;
    expect(nc.text).toBe("not compared");
    expect(nc.x).toBeCloseTo((layout.columns[2].x0 + layout.columns[3].x1) / 2);
    expect(nc.y).toBe(layout.brackets[0].y + 2);
    expect(nc.x).toBeGreaterThan(layout.brackets[0].x1);
    expect(nc.x).toBeLessThan(layout.brackets[1].x0);
  });

  it("names a period between the windows that lies beyond both, by more than 3 points or 10% of the larger median", () => {
    expect(pathLine({ entry: cont, file: FILE, fmt: fmt(CONT, cont) })).toBe("In between, it dipped to 5% in 2010–14.");
    // story length: 3,260 and 4,060 lie between 2,810 and 4,100
    expect(pathLine({ entry: length, file: FILE, fmt: fmt(WORDS, length) })).toBeNull();
    // a rise beyond both by more than 10% of the larger median; the most extreme period is named, with its unit
    const peak = { ...length, q: length.q.map((c, i) => (i === 3 ? [1564, 2340, 4600, 7200] : i === 2 ? [1522, 1940, 4700, 6000] : c)) };
    expect(pathLine({ entry: peak, file: FILE, fmt: fmt(WORDS, peak) })).toBe("In between, the median rose to 4,700 words in 2010–14.");
    // 4,500 is not 10% above 4,100
    const near = { ...length, q: length.q.map((c, i) => (i === 3 ? [1564, 2340, 4500, 7200] : c)) };
    expect(pathLine({ entry: near, file: FILE, fmt: fmt(WORDS, near) })).toBeNull();
    // never a period under 30 stories, and nothing when the windows weren't compared
    const few = { ...cont, q: cont.q.map((c, i) => (i === 2 ? [29, 0.02] : c)) };
    expect(pathLine({ entry: few, file: FILE, fmt: fmt(CONT, few) })).toBeNull();
    expect(pathLine({ entry: { ...cont, r: null }, file: FILE, fmt: fmt(CONT, cont) })).toBeNull();
    // it never says "clearly"
    expect(pathLine({ entry: cont, file: FILE, fmt: fmt(CONT, cont) })).not.toMatch(/clearly/);
  });

  it("draws a yes/no share as a dot on the line, the middle periods quiet, and breaks the line where a period isn't drawn", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 736, height: 0, top: 0, left: 0, right: 736, bottom: 0 });
    const { unmount } = render(<TrendChart meta={fixtureMeta} variable={CONT} entry={cont} file={FILE} title="Continuation" />);
    expect(document.querySelectorAll(".trend-chart .share-bar")).toHaveLength(0);
    expect(document.querySelectorAll(".trend-chart .median")).toHaveLength(5);
    expect([...document.querySelectorAll(".trend-chart g.col")].map((g) => g.classList.contains("middle"))).toEqual([false, false, true, true, false]);
    unmount();
    // Chain Stories: no story drawn in 2015–19, so no segment joins 2010–14 to 2020–26
    const chain = { ...length, q: length.q.map((c, i) => (i === 3 ? null : c)) };
    render(<TrendChart meta={fixtureMeta} variable={WORDS} entry={chain} file={FILE} title="Chain" />);
    const d = document.querySelector(".trend-chart .trend-line").getAttribute("d");
    expect(d).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/); // 2000–04 to 2010–14; 2020–26 alone has no line
  });

  it("keys a share as a dot on a short line, a median as a dot inside a capsule, and the asterisk", () => {
    const entries = (kind) => {
      const { unmount } = render(<TrendLegend kind={kind} anySmall minStories={30} />);
      const out = [...document.querySelectorAll(".trend-legend li")].map((li) => [li.textContent.trim(), [...li.querySelectorAll(".key")].map((k) => k.classList[1])]);
      unmount();
      return out;
    };
    expect(entries("num")).toEqual([
      ["Median and interquartile range", ["key-range"]],
      ["Fewer than 30 stories (*)", ["key-small"]],
      ["The periods compared (how this is decided)", ["key-bracket"]],
    ]);
    expect(entries("bin").slice(0, 2)).toEqual([
      ["Share of stories", ["key-share"]],
      ["Fewer than 30 stories (*)", ["key-small-dot"]],
    ]);
    expect(entries("zero").slice(0, 3)).toEqual([
      ["Share of stories", ["key-share"]],
      ["Median and interquartile range", ["key-range"]],
      ["Fewer than 30 stories (*)", ["key-small-dot", "key-small"]],
    ]);
  });
});

describe("View 1's layout (phase 5)", () => {
  const trends = ".trends-page .chart-panel[aria-busy='false']";

  it("makes the question the page's h1, named by its words, and the kicker a paragraph; other pages keep theirs", async () => {
    await open("#/trends?var=dlg_has_dialogue&genre=romance", { ready: trends });
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.classList.contains("sentence")).toBe(true);
    // its name is the question as words, not its controls' labels ("Story characteristic: …")
    expect(h1).toBe(screen.getByRole("heading", { level: 1, name: "In Romance, how has the share of stories with dialogue changed over time?" }));
    expect(document.querySelector(".kicker").tagName).toBe("P");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    window.location.hash = "#/trends";
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "What has changed in stories across all genres?" })).toBeTruthy());
    window.location.hash = "#/explore?var=dlg_word_share";
    await waitFor(() => expect(document.querySelector(".kicker").tagName).toBe("H1"));
    window.location.hash = "#/genres?var=dlg_word_share";
    await waitFor(() => expect(document.querySelector(".kicker")?.tagName).toBe("H1"));
  });

  it("keeps the reading order (takeaway, key, chart, actions) and lays a rail beside the chart from a 960 px answer", async () => {
    await open("#/trends?var=dlg_word_share", { ready: trends });
    const answer = document.querySelector(".trend-answer");
    expect(answer.classList.contains("with-chart")).toBe(true);
    expect([...answer.children].map((el) => el.classList[0] === "chart-head" ? "head" : el.classList.contains("trend-takeaway") ? "takeaway" : el.classList.contains("trend-legend") ? "key" : el.classList.contains("trend-chart") ? "chart" : el.className)).toEqual(["head", "takeaway", "key", "chart", "chart-actions"]);
    // an answer at least 960 px wide: the page at least 1,008 px (main's 24 px sides)
    const rail = trendsCss.slice(trendsCss.indexOf("@media (min-width: 1008px)"));
    expect(rail).toMatch(/\.trend-answer\.with-chart \{[^}]*grid-template-columns: minmax\(0, 760px\) 240px;[^}]*grid-template-areas: "head head" "chart takeaway" "chart key" "chart actions" "chart \.";[^}]*column-gap: 32px;/);
    expect(rail).toMatch(/\.trend-answer > \.chart-head \.chart-title \{\s*max-width: none;/);
    // the too-few state has no chart and no rail
    window.location.hash = "#/trends?var=dlg_word_share&genre=tiny";
    await waitFor(() => expect(screen.getByRole("button", { name: "Show All genres" })).toBeTruthy());
    expect(document.querySelector(".trend-answer").classList.contains("with-chart")).toBe(false);
  });

  it("leaves 16 px between the question's underlines and the controls, and shortens the plot in a short window, never under 200 px", () => {
    expect(trendsCss).toMatch(/\.trends-controls \{\s*margin-top: 18px;/); // 16 px under the 2 px dotted underline
    expect(plotHeight(false, 900)).toBe(250);
    expect(plotHeight(false, 720)).toBe(230); // 1280 × 720: the table and the brackets on the first screen
    expect(plotHeight(false, 600)).toBe(200);
    expect(plotHeight(false, null)).toBe(250);
    expect(plotHeight(true, 900)).toBe(200);
  });
});

describe("View 2 (phase 6)", () => {
  const trends = ".trends-page .chart-panel[aria-busy='false']";
  /** Opens an address with the trends files changed by `change(body, url)`. */
  async function openChanged(hash, change) {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => {
      const res = await serve(url);
      if (!String(url).includes("trends/") && !String(url).includes("genres/")) return res;
      const body = change(await res.json(), String(url));
      return { ok: true, status: 200, json: async () => body };
    });
    return open(hash, { ready: trends.replace(".trends-page", String(hash).includes("genres") ? ".genres-page" : ".trends-page") });
  }

  it.skipIf(!real)("counts the characteristics compared: 26 of 180 for All genres, 8, 16 and 15 of 179 with the Length options", () => {
    const counts = Object.fromEntries(
      real.trend.subsets.map((sub) => {
        const file = realTrends(sub, "all");
        const p = trendProfile(real, file);
        return [sub, changesHeading(p.flagged.length, p.compared, file)];
      }),
    );
    expect(counts).toEqual({
      all: "26 of 180 characteristics clearly changed from 2000–2009 to 2020 or later",
      short: "8 of 179 characteristics clearly changed from 2000–2009 to 2020 or later",
      medium: "16 of 179 characteristics clearly changed from 2000–2009 to 2020 or later",
      long: "15 of 179 characteristics clearly changed from 2000–2009 to 2020 or later",
    });
  });

  it.skipIf(!real)("says how long stories got first, and which changes no length band holds last (All genres, All stories)", () => {
    const file = realTrends("all", "all");
    const p = trendProfile(real, file);
    expect(lengthLine(p, file)).toBe("Stories got longer: median 2,810 words in 2000–2009, 4,100 in 2020 or later.");
    // the Length options leave word count out
    expect(lengthLine(trendProfile(real, realTrends("medium", "all")), realTrends("medium", "all"))).toBeNull();
    const bands = ["short", "medium", "long"].map((sub) => realTrends(sub, "all"));
    const tagged = notClearInBands(p, bands);
    expect([...tagged].sort()).toEqual(
      ["char_recurring_names", "dlg_word_share", "pace_dialogue_late", "qe_question_sentence_share", "qe_question_sentences_per_1k", "story_pages"].sort(),
    );
    expect(tagged.has("story_words")).toBe(false); // no entry in the length files
    expect(tagged.has("story_paragraphs")).toBe(false); // clear in all three bands
    expect(bandsLine(tagged.size)).toBe("6 of these changes are not clear within any length band.");
  });

  it("words the length line both ways and leaves it out without a clear change in word count", () => {
    const file = { then: [2000, 2009], now: [2020, 2026] };
    const nf = trendFormat({ unit: "words", bins: { type: "ranges" } }, { k: "num", fmt: "num", q: [[100, 1, 2810, 5000]], t: [100, 1, 4100, 5000] }, true, 30);
    const p = (f) => ({ items: [{ id: "story_words", f, all: { median: 4100 }, stats: { median: 2810 }, nf }] });
    expect(lengthLine(p(-1), file)).toBe("Stories got shorter: median 4,100 words in 2000–2009, 2,810 in 2020 or later.");
    expect(lengthLine(p(1), file)).toMatch(/^Stories got longer: /);
    expect(lengthLine(p(0), file)).toBeNull();
    expect(lengthLine({ items: [] }, file)).toBeNull();
    expect(bandsLine(1)).toBe("1 of these changes is not clear within any length band.");
    expect(bandsLine(0)).toBeNull();
  });

  it("tags a row no length band holds, and a borderline one, at the end of its unit line and in its name", async () => {
    // dialogue share: borderline for All genres (fm 0); has dialogue: not clear in any length band (f 0 in medium)
    await openChanged("#/trends", (body, url) => {
      if (url.includes("trends/all/all.json")) Object.assign(body.c.dlg_word_share, { fm: 0, rm: 0.15 });
      if (url.includes("trends/medium/all.json")) Object.assign(body.c.dlg_has_dialogue, { f: 0 });
      return body;
    });
    await waitFor(() => expect(document.querySelector(".changes-bands")).toBeTruthy());
    expect(document.querySelector(".changes-bands").textContent).toBe("1 of these changes is not clear within any length band.");
    const rows = [...document.querySelectorAll(".profile-list .profile-row")];
    const row = (label) => rows.find((r) => r.querySelector(".profile-label-text").textContent === label);
    expect(row("Has dialogue").querySelector(".profile-tagged").textContent).toBe("not clear within any length band");
    expect(row("Has dialogue").querySelector(".visually-hidden").textContent).toMatch(/; clearly rose; not clear within any length band\. Opens its chart over time\.$/);
    expect(row("Dialogue share").querySelector(".profile-tagged").textContent).toBe("borderline");
    expect(row("Dialogue share").querySelector(".visually-hidden").textContent).toMatch(/; clearly rose; borderline\. Opens/);
    // a piece never breaks inside, and each tag's "·" leads it (clipped at a line's start)
    const tagged = trendsCss.slice(trendsCss.indexOf(".profile-tagged {"));
    expect(tagged).toMatch(/\.profile-tag-piece \{\s*white-space: nowrap;/);
  });

  it("puts the note above the first list, titles the lists “▼ Fell” and “▲ Rose”, and names them in full", async () => {
    await open("#/trends", { ready: trends });
    const answer = document.querySelector(".trend-changes");
    const note = answer.querySelector(".profile-note");
    const first = answer.querySelector(".profile-list");
    expect(note.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(answer.querySelector(".profile-takeaway").compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Rose from 2000–2009 to 2020 or later" })).toBeTruthy();
    expect(first.querySelector("h3 [aria-hidden='true']").textContent).toBe("▲ Rose");
  });

  it.skipIf(!real)("prints the values first, with the medians' relative change only for numbers with a plain unit", () => {
    const p = trendProfile(real, realTrends("all", "all"));
    const values = (id) => changesValues(p.items.find((x) => x.id === id)).text;
    expect(values("story_mean_paragraph_words")).toBe("51.6 → 38.8 (−25%)");
    expect(values("story_paragraphs")).toBe("56 → 102 (+82%)");
    expect(values("story_words")).toBe("2,810 → 4,100 (+46%)");
    // shares, the shares with any, scales, bands and named groups: no percent
    expect(values("story_long_paragraph_share")).toBe("57% → 40%"); // mostly zero: the shares with any
    expect(values("story_has_author_note")).toBe("18% → 33%");
    expect(values("dlg_word_share")).toMatch(/^\d+% → \d+%$/); // a share, written as a percent
    expect(values("lex_mean_word_zipf")).toMatch(/^[\d.]+ → [\d.]+$/); // "Zipf scale (higher = more common)"
    expect(values("read_grade_composite")).toMatch(/^[\d.]+ → [\d.]+$/); // "US school grade"
    expect(values("pace_sex_peak_position")).toMatch(/^[^→()]+ → [^→()]+$/); // median bands
    expect(values("desc_pov")).toMatch(/^[\d.]+% → [\d.]+%$/); // the named group that changed most
    // a median of 0 has no relative change
    const zero = p.items.find((x) => x.id === "story_words");
    expect(changesValues({ ...zero, all: { ...zero.all, median: 0 } }).change).toBeNull();
    // a percent of 1,000 or more is grouped, as the site's counts are, on the row and in its name (phase 8: a build-up
    // row near 0 reached +149,028%)
    const big = { ...zero, all: { ...zero.all, median: 12 }, stats: { ...zero.stats, median: 2849 } };
    expect(changesValues(big).text).toMatch(/ \(\+23,642%\)$/);
    expect(changesRowName(big, realTrends("all", "all"), real.min_n)).toMatch(/ \(\+23,642%\);/);
  });

  it("zooms the dots' scale to 50 ± d for the whole view, d from the farthest dot, between 20 and 50, ticks every 10", () => {
    const items = (rs) => ({ items: rs.map((r) => ({ r, kind: "num" })) });
    expect(changesScale(items([0.351, -0.322, 0.1]))).toEqual({ lo: 25, hi: 75, d: 25, ticks: [30, 40, 50, 60, 70] });
    expect(changesScale(items([0.05]))).toMatchObject({ d: 20, lo: 30, hi: 70 });
    expect(changesScale(items([0.96]))).toMatchObject({ d: 50, lo: 0, hi: 100, ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] });
    // named groups' distances and rows not compared don't count
    expect(changesScale({ items: [{ r: 0.9, kind: "grp" }, { r: null, kind: "num" }, { r: 0.2, kind: "bin" }] }).d).toBe(20);
  });

  it.skipIf(!real)("gives All genres with All stories the 25–75 scale: its dots run from 34 to 68", () => {
    expect(changesScale(trendProfile(real, realTrends("all", "all")))).toEqual({ lo: 25, hi: 75, d: 25, ticks: [30, 40, 50, 60, 70] });
  });

  it("puts the head row's tick labels 4 px lower where a tick is at the zone's edge, clear of the bracket's ends", async () => {
    // found by the glyph boxes (phase 8): a zoomed scale's 40 and 60 sat under the bracket's ends, in every genre (every
    // rule's zone is 40–60); every tick keeps its label ("ticks go every 10"); "One genre"'s 0–100 ticks don't move.
    // A wide screen, where the head row carries the bracket and the tick labels.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 1032, height: 0, top: 0, left: 0, right: 1032, bottom: 0 });
    await open("#/trends", { ready: trends });
    const head = document.querySelector(".trend-changes .profile-head .profile-axis");
    expect(head.querySelector(".zone-label").textContent).toBe("40–60: no clear change");
    const ticks = changesScale(trendProfile(fixtureMeta, fixtureFile("trends/all/all.json"))).ticks;
    expect(ticks).toEqual(expect.arrayContaining([40, 60]));
    expect([...head.querySelectorAll(".tick-label")].map((t) => t.textContent)).toEqual(ticks.map(String));
    expect([...head.querySelectorAll(".tick-label")].map((t) => t.getAttribute("y"))).toEqual(ticks.map(() => "32"));
    expect(head.getAttribute("height")).toBe("34");
    expect(tickDrop({ ticks }, [40, 60])).toBe(4);
    expect(tickDrop({ ticks: [0, 25, 50, 75, 100] }, [40, 60])).toBe(0);
  });

  it("draws a named group's bars in time's order, 2000–2009 above, and says so", async () => {
    const user = await open("#/trends", { ready: trends });
    await user.click([...document.querySelectorAll(".profile-topic summary")].find((x) => x.textContent.startsWith("Narration")));
    await waitFor(() => expect(document.querySelector(".profile-topic .profile-plot rect")).toBeTruthy());
    const pov = fixtureFile("trends/all/all.json").c.pov_class;
    const row = [...document.querySelectorAll(".profile-topic .profile-row")].find((r) => r.querySelector(".profile-label-text").textContent === "Narrative perspective");
    const width = (y) => [...row.querySelectorAll(`.profile-plot rect[y='${y}']`)].map((r) => parseFloat(r.getAttribute("width")));
    expect(width(1)).toEqual(pov.t.slice(1).filter((x) => x > 0).map((x) => expect.closeTo(x * 100, 6))); // 2000–2009 above
    expect(width(12)).toEqual(pov.q[4].slice(1).filter((x) => x > 0).map((x) => expect.closeTo(x * 100, 6)));
    expect(row.closest("li").querySelector(".profile-mix-line").textContent).toBe("2000–2009 above, 2020 or later below");
  });

  it("puts one Download PNG of these changes right after the lists, and gives the image the question, heading, sample line and rows shown", async () => {
    downloadChartImage.mockClear();
    const user = await open("#/trends", { ready: trends });
    const button = screen.getByRole("button", { name: "Download PNG of these changes" });
    expect(button.textContent).toBe("Download PNG");
    const lists = [...document.querySelectorAll(".trend-changes .profile-list")];
    expect(lists[lists.length - 1].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(document.querySelector(".profile-topics")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Download PNG/ })).toHaveLength(1);
    await user.click(button);
    await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
    const spec = downloadChartImage.mock.calls[0][0];
    expect(spec.fileName).toBe("trends-changes-all-all.png");
    expect(spec.panel.classList.contains("trend-changes")).toBe(true);
    const plan = listsImagePlan(spec);
    expect(plan.title).toEqual(["What has changed in stories across all genres?"]);
    expect(plan.subtitle).toEqual([
      "2 of 4 characteristics clearly changed from 2000–2009 to 2020 or later",
      "86 stories from 2000–2009 and 87 from 2020 or later across all genres.",
    ]);
    expect(plan.lists.map((l) => [l.title, l.count, l.caption])).toEqual([
      ["▲ Rose", "2 characteristics", "How often a story from 2020 or later is the higher one against a story from 2000–2009, out\u00a0of\u00a0100"],
    ]);
    expect(plan.lists[0].rows.map((r) => r.label)).toEqual(["Dialogue share", "Has dialogue"]);
    expect(plan.lists[0].rows[0].values[0]).toMatch(/^\d+% → \d+%$/);
    expect(spec.lists.scale).toMatchObject({ lo: expect.any(Number), hi: expect.any(Number) });
    expect(spec.lists.tickDrop).toBe(4); // the tick labels under the bracket's ends go 4 px lower, as on the page
  });

  it("draws the rows the lists show, a named group's in the mix list", async () => {
    downloadChartImage.mockClear();
    // every characteristic of the test data's All genres clearly changed
    const user = await openChanged("#/trends", (body, url) => {
      if (url.includes("trends/all/all.json")) for (const e of Object.values(body.c)) Object.assign(e, { r: e.r ?? 0.3, f: 1 });
      return body;
    });
    const button = () => screen.getByRole("button", { name: "Download PNG of these changes" });
    await user.click(button());
    await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
    const plan = listsImagePlan(downloadChartImage.mock.calls[0][0]);
    const shown = [...document.querySelectorAll(".profile-list .profile-row .profile-label-text")].map((t) => t.textContent);
    expect(plan.lists.flatMap((l) => l.rows.map((r) => r.label))).toEqual(shown);
    expect(plan.lists.map((l) => l.title)).toEqual(["▲ Rose", "≠ A different mix"]);
    expect(plan.lists[1].caption).toBe("A different mix: 2000–2009 above, 2020 or later below");
  });

  it("has no Download PNG when nothing changed or the windows have too few stories", async () => {
    await openChanged("#/trends", (body) => {
      for (const e of Object.values(body.c)) e.f = 0;
      return body;
    });
    expect(document.querySelector(".profile-list")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Download PNG/ })).toBeNull();
    window.location.hash = "#/trends?genre=tiny";
    await waitFor(() => expect(screen.getByRole("button", { name: "Show All genres" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^Download PNG/ })).toBeNull();
  });

  it("gives “One genre” the same button after its lists, named for what stands out, and its own rows in the image", async () => {
    downloadChartImage.mockClear();
    // Romance standing out on purpose, as in genresProfile.test.jsx: less dialogue, more anger, a different mix
    const user = await openChanged("#/genres?view=genre&genre=romance&include=all", (body, url) => {
      if (!url.includes("genres/")) return body;
      const set = (id, r, f) => Object.assign(body.c[id], { r, f });
      set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
      set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
      set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
      return body;
    });
    const button = screen.getByRole("button", { name: "Download PNG of what stands out" });
    const lists = [...document.querySelectorAll(".genre-profile .profile-list")];
    expect(lists.length).toBeGreaterThan(0);
    expect(lists[lists.length - 1].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(document.querySelector(".profile-topics")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(button);
    await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
    const spec = downloadChartImage.mock.calls[0][0];
    expect(spec.fileName).toBe("genres-genre-romance-all.png");
    const plan = listsImagePlan(spec);
    expect(plan.title).toEqual(["What stands out about stories in Romance?"]);
    expect(plan.subtitle[1]).toBe(document.querySelector(".profile-sample").textContent);
    // its own rows: two columns' numbers under the genre's and all genres' heads, the whole 0–100 scale
    expect(spec.lists.valuesFirst).toBe(false);
    expect(spec.lists.heads).toEqual(["Romance", "All genres"]);
    expect(spec.lists.scale).toMatchObject({ lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] });
    expect(plan.lists.map((l) => l.title)).toEqual(["Lower in Romance than in all genres", "Higher in Romance than in all genres", "A different mix"]);
    expect(plan.lists[0].rows[0].numbers).toHaveLength(2);
    expect(plan.lists[2].caption).toBe("A different mix: Romance above, all genres below");
    expect(plan.lists[2].rows[0]).toMatchObject({ label: "Narrative perspective", bars: true });
  });

  it("has no Download PNG on “One genre” when nothing stands out", async () => {
    await openChanged("#/genres?view=genre&genre=romance&include=all", (body, url) => {
      if (url.includes("genres/")) for (const e of Object.values(body.c)) e.f = e.f.map(() => 0);
      return body;
    });
    expect(document.querySelector(".genre-profile .profile-list")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Download PNG/ })).toBeNull();
  });
});

describe("finding what changed, and no dead ends (phase 7)", () => {
  const trends = ".trends-page .chart-panel[aria-busy='false']";

  it.skipIf(!real)("lists what clearly changed, largest first, each with its mark and word; none when nothing was compared", () => {
    const all = pickerChanges(real, realTrends("all", "all"));
    expect(all.title).toBe("Clearly changed in all genres");
    expect(all.items).toHaveLength(26);
    expect(all.items.slice(0, 3)).toEqual([
      { id: "story_paragraphs", mark: "▲", word: "rose" },
      { id: "story_mean_paragraph_words", mark: "▼", word: "fell" },
      { id: "desc_chars", mark: "▲", word: "rose" },
    ]);
    expect(pickerChanges(real, realTrends("medium", "all")).title).toBe("Clearly changed in all genres · 2,000–5,000 words");
    expect(pickerChanges(real, realTrends("medium", "all")).items).toHaveLength(16);
    expect(pickerChanges(real, realTrends("all", "adult-romance")).title).toBe("Clearly changed in Romance");
    expect(pickerChanges(real, realTrends("all", "chain-stories"))).toBeNull(); // too few to compare
  });

  it("shows the group above Popular, the first ten and “Show all {k}”, the marks hidden and the names saying the change", async () => {
    const items = Array.from({ length: 12 }, (_, k) => ({ id: k % 2 ? "dlg_word_share" : "emo_anger_per_1k", mark: k % 2 ? "▲" : "▼", word: k % 2 ? "rose" : "fell" }));
    // the test data has four characteristics: repeat them to have more than ten
    const changed = { title: "Clearly changed in all genres", items: items.map((x, k) => ({ ...x, key: k })) };
    const meta = { ...fixtureMeta, popular: ["dlg_word_share"] };
    const focus = { current: null };
    const scroll = { current: null };
    render(<CharacteristicPicker meta={meta} value="pov_class" onPick={() => {}} focusRef={focus} scrollRef={scroll} changed={changed} />);
    const sections = [...document.querySelectorAll(".pick-section")].map((x) => x.textContent);
    expect(sections.slice(0, 2)).toEqual(["Clearly changed in all genres", "Popular"]);
    const group = document.querySelector(".pick-changed");
    const chips = [...group.querySelectorAll("[role='option']")];
    expect(chips).toHaveLength(11); // ten, then "Show all 12"
    expect(chips[10].textContent).toBe("Show all 12");
    expect(chips[0].querySelector(".chip-mark").getAttribute("aria-hidden")).toBe("true");
    expect(chips[0].textContent).toBe("▼Anger, fell");
    expect(chips[1].textContent).toBe("▲Dialogue share, rose");
    fireEvent.click(chips[10]);
    expect(group.querySelectorAll("[role='option']")).toHaveLength(12);
    expect(group.textContent).not.toMatch(/Show all/);
  });

  it("leaves the group out of Explore's and the Genres page's pickers", async () => {
    const user = await open("#/explore?var=dlg_word_share");
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    await waitFor(() => expect(document.querySelector(".pick-list")).toBeTruthy());
    expect(document.querySelector(".pick-changed")).toBeNull();
  });

  it("offers the group in View 1's picker, from the file on screen", async () => {
    const user = await open("#/trends?var=pov_class", { ready: trends });
    await user.click(screen.getByRole("button", { name: /^Story characteristic:/ }));
    await waitFor(() => expect(document.querySelector(".pick-changed")).toBeTruthy());
    const group = document.querySelector(".pick-changed");
    expect(group.querySelector(".pick-section").textContent).toBe("Clearly changed in all genres");
    expect([...group.querySelectorAll("[role='option']")].map((o) => o.textContent)).toEqual(["▲Dialogue share, rose", "▲Has dialogue, rose"]);
  });

  it("says “(too few to compare)” after each genre whose windows can't be compared with the option, which stays selectable", async () => {
    await open("#/trends", { ready: trends });
    const names = () => [...screen.getByLabelText("Genre").options].map((o) => o.textContent);
    expect(names()).toEqual(["All genres", "Fetish", "Romance", "Tiny Genre (too few to compare)"]);
    expect(fixtureMeta.trend.too_few.short).toEqual(["all", "fetish", "romance", "tiny"]);
    window.location.hash = "#/trends?include=short";
    await waitFor(() => expect(names()).toEqual(["All genres (too few to compare)", "Fetish (too few to compare)", "Romance (too few to compare)", "Tiny Genre (too few to compare)"]));
    expect([...screen.getByLabelText("Genre").options].every((o) => !o.disabled)).toBe(true);
  });

  it("gives a genre too few to compare its stories per period, never a count under 10, and two ways on", async () => {
    await open("#/trends?genre=tiny", { ready: trends });
    const table = document.querySelector(".trend-few-table");
    expect(table.querySelector("caption").textContent).toBe("Stories per period");
    expect([...table.querySelectorAll("th")].map((t) => t.textContent)).toEqual(["2000–04", "2005–09", "2010–14", "2015–19", "2020–26"]);
    const counts = fixtureFile("trends/all/tiny.json").n;
    expect([...table.querySelectorAll("td")].map((t) => t.textContent)).toEqual(counts.map((n) => (n < 10 ? "fewer than 10" : String(n))));
    expect(screen.getByRole("button", { name: "Show All genres" })).toBeTruthy();
    const over = screen.getByRole("link", { name: "One characteristic over time →" });
    expect(over.className).toBe("btn");
    // the remembered characteristic, else the first (story length on the real data)
    expect(over.getAttribute("href")).toBe("#/trends?var=dlg_word_share&genre=tiny&include=all");
  });

  it("opens paragraph count over time when the option rules word count out", () => {
    const meta = { subsets: fixtureMeta.subsets };
    expect(overTimeCharacteristic(meta, { v: "story_words", sub: "all" })).toBe("story_words");
    expect(overTimeCharacteristic(meta, { v: "story_words", sub: "short" })).toBe("story_paragraphs");
    expect(overTimeCharacteristic(meta, { v: "pov_class", sub: "short" })).toBe("pov_class");
    expect(overTimeCharacteristic(meta, { sub: "medium" })).toBe("story_paragraphs");
  });

  it("leaves out the options that don't apply, and with only All stories left says so as plain text (the Trends page only)", () => {
    const subsets = fixtureMeta.subsets.filter((x) => fixtureMeta.trend.subsets.includes(x.id));
    const words = { id: "story_words", label: "Word count", bins: { type: "ranges" } };
    const { unmount } = render(<IncludeSelect subsets={subsets} value="all" variable={words} onChange={() => {}} omitConflicts />);
    const fixed = document.querySelector(".include-fixed");
    expect(fixed.textContent).toBe("Only include: All stories Length options don’t apply to word count");
    expect(document.querySelector("select")).toBeNull();
    unmount();
    const dialogue = fixtureMeta.variables.find((v) => v.id === "dlg_word_share");
    const two = render(<IncludeSelect subsets={subsets} value="all" variable={dialogue} onChange={() => {}} omitConflicts />);
    expect([...document.querySelector("select").options].map((o) => o.textContent)).toEqual(subsets.map((x) => x.label));
    two.unmount();
    // the Genres page keeps its turned-off options
    render(<IncludeSelect subsets={subsets} value="all" variable={words} onChange={() => {}} />);
    const off = [...document.querySelector("select").options].filter((o) => o.disabled).map((o) => o.textContent);
    expect(off).toEqual(subsets.filter((x) => x.group === "Length").map((x) => `${x.label} (not with word count)`));
  });
});
