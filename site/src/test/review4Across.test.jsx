// Design review 4, phase 7 (I15): one way across. Under Explore's chart, the Genres page's one characteristic and the
// Trends page's, one line of links to the same characteristic on the other pages, named the same way: "By genre →",
// "Over time →", "With popularity →". A link shows only where its page has the characteristic; the page being read
// drops out. They replace "Open in Explore →", "Compare genres →" and Keep exploring's two characteristic items.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import WayAcross from "../components/WayAcross.jsx";
import { clearCache } from "../lib/data.js";
import { GENRE_PAGE_EXCLUDED, TREND_PAGE_EXCLUDED } from "../lib/urlState.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "..", "styles.css"), "utf8");

let asked = [];
beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  const serve = fixtureFetch();
  asked = [];
  vi.stubGlobal("fetch", async (url) => {
    asked.push(String(url));
    return serve(url);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".chart-panel[aria-busy='false'] .way-across")).toBeTruthy());
  return document.querySelector(".chart-panel[aria-busy='false'] .way-across");
}

const links = (line) => within(line).getAllByRole("link");
const shown = (line) => links(line).map((a) => [a.textContent, a.getAttribute("aria-label"), a.getAttribute("href")]);

describe("I15: the same line under every one-characteristic chart", () => {
  it("on Explore: “By genre →” with its option, “Over time →” with its genre and option, right under the chart", async () => {
    const line = await open("#/explore?genre=romance&var=dlg_word_share&include=medium");
    // the Genres page's one characteristic offers no Length option (the owner, 2026-10-19): All stories there
    expect(shown(line)).toEqual([
      ["By genre →", "Dialogue share by genre", "#/genres?var=dlg_word_share&include=all"],
      ["Over time →", "Dialogue share over time", "#/trends?var=dlg_word_share&genre=romance&include=medium"],
    ]);
    expect(line.previousElementSibling.classList.contains("range-chart")).toBe(true);
    // "Download image" stays Explore's only button
    expect([...document.querySelectorAll(".chart-actions button, .chart-actions a")].map((el) => el.textContent)).toEqual(["Download image"]);
  });

  it("on the Genres page: “Over time →” (all stories where the Trends page doesn't offer the option) and “With popularity →”", async () => {
    const line = await open("#/genres?var=dlg_word_share&include=y2020");
    expect(shown(line)).toEqual([
      ["Over time →", "Dialogue share over time", "#/trends?var=dlg_word_share&genre=all&include=all"],
      ["With popularity →", "Dialogue share with popularity", "#/explore?genre=all&var=dlg_word_share&include=y2020"],
    ]);
    expect(line.previousElementSibling.classList.contains("genre-chart")).toBe(true);
    expect(line.nextElementSibling.className).toBe("chart-actions");
    expect(screen.queryByRole("link", { name: /^Open in Explore/ })).toBeNull();
  });

  it("on the Trends page: “By genre →” and “With popularity →” with its genre and option, under the chart in its cell", async () => {
    const line = await open("#/trends?var=dlg_word_share&genre=romance&include=medium");
    expect(shown(line)).toEqual([
      ["By genre →", "Dialogue share by genre", "#/genres?var=dlg_word_share&include=all"], // no Length option there
      ["With popularity →", "Dialogue share with popularity", "#/explore?genre=romance&var=dlg_word_share&include=medium"],
    ]);
    expect(line.parentElement.className).toBe("trend-chart-cell");
    expect(line.previousElementSibling.classList.contains("trend-chart")).toBe(true);
    expect(screen.queryByRole("link", { name: /^Compare genres/ })).toBeNull();
    // "See all changes →" stays the primary action, with "Download image"
    const actions = document.querySelector(".trend-answer .chart-actions");
    expect([...actions.querySelectorAll("a, button")].map((el) => [el.textContent, el.className])).toEqual([
      ["See all changes →", "btn primary"],
      ["Download image", "btn"],
    ]);
  });

  it("carries the measure last used on Explore into “With popularity →”, on both pages", async () => {
    await open("#/explore?var=dlg_word_share&metric=pop_views");
    window.location.hash = "#/genres?var=dlg_word_share";
    await waitFor(() => expect(screen.getByRole("link", { name: "Dialogue share with popularity" })).toBeTruthy());
    expect(screen.getByRole("link", { name: "Dialogue share with popularity" }).getAttribute("href")).toBe(
      "#/explore?genre=all&metric=pop_views&var=dlg_word_share&include=all",
    );
    window.location.hash = "#/trends?var=dlg_word_share&genre=fetish";
    await waitFor(() => expect(document.querySelector(".trend-answer .way-across")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Dialogue share with popularity" }).getAttribute("href")).toBe(
      "#/explore?genre=fetish&metric=pop_views&var=dlg_word_share&include=all",
    );
  });

  it("fetches each page's file ahead of time when a link is hovered or focused", async () => {
    const line = await open("#/explore?genre=fetish&var=dlg_word_share&include=short");
    const [byGenre, overTime] = links(line);
    fireEvent.pointerEnter(byGenre);
    // the file the link opens: All stories', the Genres page's one characteristic offering no Length option
    await waitFor(() => expect(asked.some((u) => u.endsWith("genres/all.json"))).toBe(true));
    expect(asked.some((u) => u.endsWith("genres/short.json"))).toBe(false);
    fireEvent.focus(overTime);
    await waitFor(() => expect(asked.some((u) => u.endsWith("trends/short/fetish.json"))).toBe(true));
    cleanup();
    const genres = await open("#/genres?var=dlg_word_share&include=y2020");
    const popularity = links(genres).find((a) => a.textContent.startsWith("With popularity"));
    fireEvent.focus(popularity);
    await waitFor(() => expect(asked.some((u) => u.endsWith("v/dlg_word_share/y2020.json"))).toBe(true));
  });
});

describe("I15: a link only where its page has the characteristic, never the page being read", () => {
  const variable = (id, label) => ({ ...fixtureMeta.variables[0], id, label, noun: label.toLowerCase() });
  const words = (page, v) =>
    [...render(<WayAcross meta={fixtureMeta} page={page} variable={v} />).container.querySelectorAll("a")].map((a) => a.textContent.split(" ")[0]);

  it("leaves the Genres page out for month and weekday, and the Trends page out for meta.trend.excluded", () => {
    expect(TREND_PAGE_EXCLUDED).toEqual(fixtureMeta.trend.excluded);
    for (const id of GENRE_PAGE_EXCLUDED) {
      expect(words("explore", variable(id, "Publication month"))).not.toContain("By genre");
      cleanup();
    }
    for (const id of fixtureMeta.trend.excluded) {
      const w = words("explore", variable(id, "Excluded"));
      expect(w).not.toContain("Over time");
      expect(w).toEqual(GENRE_PAGE_EXCLUDED.includes(id) ? [] : ["By genre"]);
      cleanup();
    }
    // nothing to link to: no line at all
    expect(render(<WayAcross meta={fixtureMeta} page="explore" variable={variable("pub_month", "Publication month")} />).container.innerHTML).toBe("");
    cleanup();
    // without a Trends page (no meta.trend), no "Over time →"
    const noTrend = render(<WayAcross meta={{ ...fixtureMeta, trend: undefined }} page="genres" variable={variable("dlg_word_share", "Dialogue share")} />);
    expect([...noTrend.container.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["With popularity →"]);
  });

  it("drops the page being read, and keeps the order By genre, Over time, With popularity", () => {
    const v = variable("dlg_word_share", "Dialogue share");
    const all = { explore: ["By genre", "Over time"], genres: ["Over time", "With popularity"], trends: ["By genre", "With popularity"] };
    for (const [page, expected] of Object.entries(all)) {
      expect(words(page, v)).toEqual(expected);
      cleanup();
    }
    expect(words("methodology", v)).toEqual(["By genre", "Over time", "With popularity"]);
  });

  it("names each link for the characteristic, its visible words last, and links only to that characteristic", () => {
    const v = variable("dlg_word_share", "Dialogue share");
    const { container } = render(<WayAcross meta={fixtureMeta} page="methodology" variable={v} sub="medium" genre="romance" />);
    const as = [...container.querySelectorAll("a")];
    expect(as.map((a) => a.getAttribute("aria-label"))).toEqual(["Dialogue share by genre", "Dialogue share over time", "Dialogue share with popularity"]);
    for (const a of as) {
      const visible = a.textContent.replace(/ →$/, "").toLowerCase();
      expect(a.getAttribute("aria-label").toLowerCase().endsWith(visible)).toBe(true); // label in name
      expect(new URLSearchParams(a.getAttribute("href").split("?")[1]).get("var")).toBe("dlg_word_share");
    }
  });
});

describe("I15: what the line replaces, and how it looks", () => {
  it("leaves Keep exploring its Patterns item, the One genre item and the example questions", async () => {
    await open("#/explore?genre=romance&var=dlg_word_share");
    const items = within(screen.getByRole("navigation", { name: "Keep exploring" })).getAllByRole("link").map((a) => a.textContent);
    expect(items[0]).toMatch(/^Every clear pattern with /);
    expect(items[1]).toBe("What stands out about stories in Romance? →");
    expect(items.some((t) => /^How (do genres differ|has|have)/.test(t))).toBe(false);
  });

  it("makes every link a 44 px target, in the site's link color, with no new size", () => {
    expect(styles).toMatch(/\.way-across \{[^}]*font-size: var\(--text-15\);[^}]*line-height: var\(--leading-15\);/);
    expect(styles).toMatch(/\.way-across a \{[^}]*min-height: var\(--target\);/);
    expect(styles).not.toMatch(/\.way-across[^{]*\{[^}]*color:/);
  });

  it("words its links in US English, never causally", () => {
    for (const w of ["By genre", "Over time", "With popularity", "Word count by genre", "Word count over time", "Word count with popularity"]) {
      expect(w).not.toMatch(UK_SPELLINGS);
      expect(w).not.toMatch(CAUSAL);
    }
  });
});
