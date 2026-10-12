// The Trends page's review (STAGE2_TRENDS_REVIEW_IMPLEMENTATION_PROMPT.md): the site-wide fixes and the wording
// (phase 2). The layouts that jsdom can't measure (the kicker's lines, the footer's page list, the space above the
// footer) are checked in a browser by the review's scripts; here, the structure that makes them work.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { changesQuestion, changesSampleLine, trendQuestion, trendQuestionText } from "../lib/trends.js";
import { onTrendsPage } from "../lib/urlState.js";
import { changedOverTime } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8");
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
    const kicker = screen.getByRole("heading", { level: 1 });
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
