// The Trends page's shell (STAGE2_TRENDS_PAGE_PROMPT.md, section 2): its addresses and their sanitizing, the masthead
// and the footer (D7, D8), the lazy page, loading and errors, and the genre it opens on (D9).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import CharacteristicPicker from "../components/CharacteristicPicker.jsx";
import { TrendsPage } from "../components/pages.js";
import { clearCache } from "../lib/data.js";
import { GENRE_PAGE_EXCLUDED, TREND_PAGE_EXCLUDED, parseHash, sanitizeTrends, toHash } from "../lib/urlState.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
let fetchMock;

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  fetchMock = fixtureFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openTrends(hash = "#/trends") {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".trends-page .chart-panel[aria-busy='false']")).toBeTruthy());
  return user;
}

const masthead = () => screen.getByRole("navigation", { name: "Pages" });

describe("Trends addresses", () => {
  it("round-trip both views, in the documented order, with no option (the owner, 2026-10-20)", () => {
    const chart = { v: "dlg_word_share", genre: "adult-romance" };
    expect(toHash("trends", chart)).toBe("#/trends?var=dlg_word_share&genre=adult-romance");
    expect(parseHash(toHash("trends", chart))).toEqual({ page: "trends", state: chart });
    // an old address's option is not read, and never written
    expect(parseHash("#/trends?var=dlg_word_share&genre=adult-romance&include=medium")).toEqual({ page: "trends", state: chart });
    expect(toHash("trends", { ...chart, sub: "medium" })).toBe("#/trends?var=dlg_word_share&genre=adult-romance");
    const changes = { view: "changes", genre: "all" };
    // what changed, the page's default (O4), is written without `view`, and without the characteristic it keeps for
    // the way back; the trends page build's addresses with view=changes still read as what changed
    expect(toHash("trends", { ...changes, v: "story_words" })).toBe("#/trends?genre=all");
    expect(parseHash(toHash("trends", { ...changes, genre: "adult-romance" }))).toEqual({ page: "trends", state: { genre: "adult-romance" } });
    expect(parseHash("#/trends?view=changes&genre=all&include=all")).toEqual({ page: "trends", state: changes });
    expect(parseHash("#/trends")).toEqual({ page: "trends", state: {} });
    expect(toHash("trends", {})).toBe("#/trends");
    // the other pages' addresses are unchanged
    expect(parseHash("#/genres?view=genre&genre=romance").page).toBe("genres");
    expect(parseHash("#/explore?var=story_words").state).toEqual({ v: "story_words" });
    expect(parseHash("#/methodology/trends")).toMatchObject({ page: "methodology", section: "trends" });
  });

  it("sanitizes: characteristic, genre and view; there is no option", () => {
    const meta = fixtureMeta;
    // the test data has no story length: the page's first characteristic stands in. Without a characteristic the page
    // opens on what changed (O4), with All genres; with one, on its chart over time
    expect(sanitizeTrends({}, meta)).toEqual({ view: "changes", genre: "all", v: "dlg_word_share" });
    expect(sanitizeTrends({ genre: "romance", sub: "medium" }, meta)).toEqual({ view: "changes", genre: "romance", v: "dlg_word_share" });
    expect(sanitizeTrends({ v: "pov_class" }, meta)).toEqual({ v: "pov_class", genre: "all" });
    expect(sanitizeTrends({ v: "nope", genre: "nope", sub: "nope", view: "nope" }, meta)).toEqual({
      v: "dlg_word_share",
      genre: "all",
    });
    // any option, from an old link, is dropped
    expect(sanitizeTrends({ v: "pov_class", genre: "romance", sub: "y2020" }, meta)).toEqual({ v: "pov_class", genre: "romance" });
    expect(sanitizeTrends({ v: "pov_class", sub: "long" }, meta)).toEqual({ v: "pov_class", genre: "all" });
    // what changed keeps its characteristic for the way back
    expect(sanitizeTrends({ view: "changes", genre: "fetish", sub: "medium", v: "emo_anger_per_1k" }, meta)).toEqual({
      view: "changes",
      genre: "fetish",
      v: "emo_anger_per_1k",
    });
    expect(TREND_PAGE_EXCLUDED).toEqual(meta.trend.excluded);
    expect(meta.trend.subsets).toEqual(["all"]);
  });

  it.skipIf(!real)("leaves out the excluded characteristics, and keeps story length whatever an old link says (the real data)", () => {
    for (const id of real.trend.excluded) expect(sanitizeTrends({ v: id }, real).v).toBe("story_words");
    expect(sanitizeTrends({ v: "story_words", sub: "short" }, real)).toEqual({ v: "story_words", genre: "all" });
    expect(sanitizeTrends({ sub: "long" }, real)).toEqual({ view: "changes", genre: "all", v: "story_words" });
    expect(real.trend.subsets).toEqual(["all"]);
  });

  it("settles an old address with an option to the address without it, in place", async () => {
    await openTrends("#/trends?var=pov_class&genre=fetish&include=medium");
    expect(window.location.hash).toBe("#/trends?var=pov_class&genre=fetish");
    expect(screen.queryByLabelText("Only include")).toBeNull();
    expect(fetchMock.calls.some((u) => /trends\/(short|medium|long)\//.test(u))).toBe(false);
  });
});

describe("the masthead and the footer (D7, D8)", () => {
  it("puts Trends between Genres and How it works, current on its page; the footer has no list of pages", async () => {
    await openTrends();
    const links = within(masthead()).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Popularity", "Genres", "Trends", "How it works"]);
    expect(within(masthead()).getByRole("link", { name: "Trends" }).getAttribute("aria-current")).toBe("page");
    expect(within(masthead()).getByRole("button", { name: "Trends, menu" })).toBeTruthy(); // on a phone
    expect(screen.queryByRole("navigation", { name: "All pages" })).toBeNull(); // the owner, 2026-10-13
    const css = readFileSync(path.join(here, "..", "styles.css"), "utf8");
    expect(css).not.toMatch(/footer-pages/);
  });

  it("links Trends to the last Trends address of the visit, else the page's own, and fetches the code and file ahead", async () => {
    window.history.replaceState(null, "", "/#/explore?genre=romance&var=dlg_word_share");
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false']")).toBeTruthy());
    const preload = vi.spyOn(TrendsPage, "preload");
    const trends = within(masthead()).getByRole("link", { name: "Trends" });
    expect(trends.getAttribute("href")).toBe("#/trends"); // not the genre chosen on Explore (D9)
    await user.hover(trends);
    expect(preload).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith("trends/all/all.json"))).toBe(true));
    await user.click(trends);
    await waitFor(() => expect(document.querySelector(".trends-page .chart-panel[aria-busy='false']")).toBeTruthy());
    expect(screen.getByLabelText("Genre").value).toBe("all");
    window.location.hash = "#/trends?var=pov_class&genre=fetish";
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("fetish"));
    window.location.hash = "#/patterns";
    await screen.findByRole("heading", { level: 1, name: /^Clear patterns in / }); // the question, its h1 (round 4's X2)
    const back = within(masthead()).getByRole("link", { name: "Trends" });
    expect(back.getAttribute("href")).toBe("#/trends?var=pov_class&genre=fetish");
    await user.hover(back);
    await waitFor(() => expect(fetchMock.calls.some((u) => u.endsWith("trends/all/fetish.json"))).toBe(true));
  });

  it("counts a genre chosen on this page as chosen for the Genres page (D8)", async () => {
    const user = await openTrends("#/trends?var=pov_class");
    await user.selectOptions(screen.getByLabelText("Genre"), "fetish");
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=pov_class&genre=fetish"));
    window.location.hash = "#/genres?view=genre";
    await waitFor(() => expect(screen.getByLabelText("Genre").value).toBe("fetish"));
  });
});

describe("the page shell", () => {
  it("has its own title, kicker and page marker, and the skip link goes to the question", async () => {
    const user = await openTrends();
    expect(document.documentElement.dataset.page).toBe("trends");
    // the kicker, a paragraph here: the question is the page's h1 (the trends review, phase 5)
    expect(document.querySelector(".kicker").textContent).toBe(
      "Trends · 278 Literotica stories · 2000–2026", // the page and the source (round 4's U1); the years from meta.trend
    );
    expect(document.querySelector(".kicker").tagName).toBe("P");
    expect(screen.getByRole("heading", { level: 1, name: "What has changed in stories across all genres?" })).toBeTruthy();
    // the page opens on what changed (O4)
    await waitFor(() => expect(document.title).toBe("What has changed in stories across all genres?"));
    await user.click(screen.getByText("Skip to content"));
    expect(document.activeElement.id).toBe("question");
  });

  it("asks both questions with the genre in a slot, and switches views with a history entry", async () => {
    const user = await openTrends("#/trends?var=dlg_has_dialogue&genre=romance");
    // the sentence as it reads on screen: the selects show their chosen option, hidden words aside
    const question = () => {
      const p = document.querySelector("#question .sentence").cloneNode(true);
      for (const el of p.querySelectorAll("select, .visually-hidden")) el.remove();
      return p.textContent.replace(/\u2060/g, "");
    };
    expect(question()).toBe("In Romance, how has the share of stories with dialogue changed over time?");
    const length = window.history.length;
    await user.click(screen.getByRole("radio", { name: "All changes" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=romance"));
    expect(window.history.length).toBe(length + 1);
    expect(question()).toBe("What has changed in stories in Romance?");
    await waitFor(() => expect(document.title).toBe("What has changed in stories in Romance?"));
    await user.click(screen.getByRole("radio", { name: "One characteristic" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=dlg_has_dialogue&genre=romance"));
    // a control replaces the address: no new entry
    const now = window.history.length;
    await user.selectOptions(screen.getByLabelText("Genre"), "fetish");
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=dlg_has_dialogue&genre=fetish"));
    expect(window.history.length).toBe(now);
  });

  it("has no “Only include” in either view: the overall view only (the owner, 2026-10-20)", async () => {
    const user = await openTrends();
    expect(screen.queryByLabelText("Only include")).toBeNull();
    expect(screen.queryByText("Only include:")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "One characteristic" }));
    await waitFor(() => expect(document.querySelector(".trends-page .trend-answer[aria-busy='false']")).toBeTruthy());
    expect(screen.queryByLabelText("Only include")).toBeNull();
    // the controls under the question hold the view switch alone
    expect(document.querySelector(".trends-controls").children).toHaveLength(1);
  });

  it("loads the page's code on demand, holding its place meanwhile", async () => {
    const pages = readFileSync(path.join(here, "..", "components", "pages.js"), "utf8");
    expect(pages).toMatch(/export const TrendsPage = lazyPart\(\(\) => import\("\.\/TrendsPage\.jsx"\)\)/);
    const config = readFileSync(path.join(here, "..", "..", "vite.config.js"), "utf8");
    const lazy = new RegExp(config.match(/const LAZY =\s*(\/.*\/);/)[1].slice(1, -1));
    for (const f of ["components/TrendsPage.jsx", "components/TrendChart.jsx", "components/IncludeSelect.jsx", "lib/trends.js", "lib/trendLayout.js", "trends.css"]) {
      expect(lazy.test(`/x/src/${f}`)).toBe(true);
    }
    expect(lazy.test("/x/src/components/InlineSelect.jsx")).toBe(false); // Explore's, in the first load
  });

  it("fetches the page's file at once when the visit starts on it, before meta.json", async () => {
    await openTrends("#/trends?genre=romance&include=medium"); // an old link's option fetches nothing of its own
    const first = fetchMock.calls.findIndex((u) => u.endsWith("trends/all/romance.json"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(fetchMock.calls.findIndex((u) => u.endsWith("meta.json")));
    expect(fetchMock.calls.filter((u) => u.endsWith("trends/all/romance.json"))).toHaveLength(1); // the same request
    expect(fetchMock.calls.some((u) => u.includes("trends/medium/"))).toBe(false);
  });

  it("shows a friendly error when the file cannot be loaded, and loads it again on Try again", async () => {
    let fail = true;
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => (fail && String(url).includes("trends/") ? { ok: false, status: 503 } : serve(url)));
    window.history.replaceState(null, "", "/#/trends");
    const user = userEvent.setup();
    render(<App />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    await user.click(retry);
    await waitFor(() => expect(document.querySelector(".trends-page .chart-panel[aria-busy='false']")).toBeTruthy());
  });
});

describe("the characteristic picker on this page", () => {
  const topics = (exclude, keepBlurbs) => {
    const focus = { current: null };
    const { unmount } = render(
      <CharacteristicPicker meta={real} value="story_words" exclude={exclude} keepBlurbs={keepBlurbs} focusRef={focus} scrollRef={{ current: null }} onPick={() => {}} onClose={() => {}} />,
    );
    const out = Object.fromEntries(real.topics.map((t) => [t.label, screen.queryAllByRole("option").find((o) => o.textContent.startsWith(t.label))?.textContent ?? null]));
    unmount();
    return out;
  };

  it.skipIf(!real)("leaves out When published, and Length & structure keeps its own blurb (the real data)", () => {
    const trends = topics(TREND_PAGE_EXCLUDED, ["length"]);
    expect(trends["When published"]).toBeNull();
    expect(trends["Length & structure"]).toMatch(/Word count, paragraphs, series, titles/);
    // the Genres page's picker is as before: When published lists what is left of it (F77)
    const genres = topics(GENRE_PAGE_EXCLUDED, null);
    expect(genres["When published"]).toMatch(/Publication year, published on a weekend, story age \(years online\)/);
    expect(genres["Length & structure"]).toMatch(/Word count, paragraphs, series, titles/);
  });
});
