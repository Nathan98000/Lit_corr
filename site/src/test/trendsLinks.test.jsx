// The Trends page's links in from other pages (STAGE2_TRENDS_PAGE_PROMPT.md, section 5): the "Over time →" under
// Explore's chart (round 4's I15, once Keep exploring's item) and How it works' "Changes over time", whose numbers come
// from meta.trend and meta.source.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { SECTIONS } from "../components/Methodology.jsx";
import { clearCache } from "../lib/data.js";
import { overTimeState, toHash } from "../lib/urlState.js";
import { fixtureFetch, fixtureMeta } from "./fixtures.js";

/** Serves the fixture, with `edit(meta)` applied to meta.json; `asked` lists the addresses fetched. */
let asked = [];
function serve(edit = (m) => m) {
  const base = fixtureFetch();
  asked = [];
  vi.stubGlobal("fetch", async (url) => {
    asked.push(String(url));
    if (!String(url).endsWith("meta.json")) return base(url);
    const meta = edit(structuredClone(fixtureMeta));
    return { ok: true, status: 200, json: async () => meta };
  });
}

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open(hash) {
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const byId = (id) => fixtureMeta.variables.find((v) => v.id === id);

describe("Explore's “Over time →” (round 4's I15)", () => {
  it("opens View 1 with Explore's genre and, when the Trends page offers it, Explore's option, else all stories", () => {
    const over = (sub, genre = "all") => toHash("trends", overTimeState(fixtureMeta, byId("dlg_word_share"), genre, sub));
    expect(over("medium", "romance")).toBe("#/trends?var=dlg_word_share&genre=romance&include=medium");
    expect(over("y2020")).toBe("#/trends?var=dlg_word_share&genre=all&include=all"); // not one of the page's options
    expect(overTimeState(fixtureMeta, byId("dlg_word_share"), "all", "views10k").sub).toBe("all");
    // word count with a Length option: the option would leave one group, so all stories
    const words = { id: "story_words", label: "Word count", noun: "word count" };
    expect(overTimeState(fixtureMeta, words, "all", "short").sub).toBe("all");
    // a characteristic the page leaves out, or no Trends page: no link
    expect(overTimeState(fixtureMeta, { id: "pub_year", label: "Publication year", noun: "publication year" })).toBeNull();
    expect(overTimeState({ ...fixtureMeta, trend: undefined }, byId("dlg_word_share"))).toBeNull();
  });

  it("sits under the chart after “By genre →”, and fetches the page's code and file when hovered", async () => {
    await open("#/explore?var=dlg_has_dialogue&genre=fetish&include=short");
    const line = await waitFor(() => {
      const el = document.querySelector(".chart-panel[aria-busy='false'] .way-across");
      expect(el).toBeTruthy();
      return el;
    });
    const links = within(line).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["By genre\u00a0→", "Over time\u00a0→"]);
    const over = links[1];
    expect(over.getAttribute("aria-label")).toBe("Has dialogue over time");
    expect(over.getAttribute("href")).toBe("#/trends?var=dlg_has_dialogue&genre=fetish&include=short");
    fireEvent.pointerEnter(over);
    await waitFor(() => expect(asked.some((u) => u.endsWith("trends/short/fetish.json"))).toBe(true));
  });
});

/**
 * "Changes over time", block by block: each paragraph, each list item and "figure" for the picture, from its heading
 * to the next, without the word joiners that keep a range of years on one line.
 */
function sectionText(heading) {
  const out = [];
  const words = (node) => node.textContent.replace(/\u2060/g, "").replace(/\s+/g, " ").trim();
  for (let el = heading.nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling) {
    if (el.tagName === "UL") out.push(...[...el.children].map(words));
    else out.push(el.tagName === "FIGURE" ? "figure" : words(el));
  }
  return out;
}

describe("How it works' “Changes over time”", () => {
  it("comes after “Comparing genres” in the contents", () => {
    const ids = SECTIONS.map(([id]) => id);
    expect(ids.indexOf("trends")).toBe(ids.indexOf("genres") + 1);
    expect(SECTIONS[ids.indexOf("trends")][1]).toBe("Changes over time");
  });

  it("says the periods, the rule and the windows from meta.trend, and the collection's end from meta.source", async () => {
    await open("#/methodology/trends");
    const heading = await screen.findByRole("heading", { level: 2, name: "Changes over time" });
    // a word joiner keeps each range of years on one line
    expect(heading.nextElementSibling.textContent).toContain("2010–\u206014");
    expect(sectionText(heading)).toEqual([
      "The Trends page groups stories by the year they were published: 2000–04, 2005–09, 2010–14, 2015–19, and 2020 to the end of the collection (October 2026).",
      "figure",
      "For each period it shows the median and the interquartile range, or the share of stories, with All genres counting each genre by its size on Literotica, as everywhere on this site.",
      // why only the two windows count (the trends review's fresh eyes asked, 6/6)
      "It compares two windows, the stories published 2000–2009 and those published 2020 or later: the oldest and the newest, each pooling several years, so that no thin year can swing the verdict. The periods between are drawn but not compared, so a characteristic that dipped and came back reads “No clear change”; the chart shows the whole shape.",
      "A characteristic clearly changed when, picking one story published in 2020 or later and one published 2000–2009 at random, the newer story would be the higher one at least 60 times in 100, or the lower one at least 60 times in 100 (ties count as half), clear at the 99.9% level, with at least 30 stories on each side. That is the Genres page’s rule. For yes/no characteristics it means a change of at least 20 percentage points; for characteristics with named groups, at least 20% of the newer stories would have to change group to match the mix of 2000–2009.",
      "Keep in mind",
      // no fixed-mix check and no length bands: the owner took both off the page (2026-10-12)
      "The stories are the ones still on Literotica when they were collected, in today’s categories: stories removed from the site are not in the sample.",
      "Two characteristics are not on this page: the number of tags, which jumps between stories published before 2005 (a median of 10) and after (4), and the author’s number of stories, which was counted when the stories were collected, not when they were published.",
    ]);
    // the picture: the periods, the two windows it compares named above them, the periods between in gray
    const figure = heading.parentElement.querySelector(".trends-figure");
    expect(figure.querySelector("figcaption").textContent).toBe("The Trends page’s periods, and the two windows it compares");
    const drawn = [...figure.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(drawn.slice(0, 2)).toEqual(["2000–2009", "2020 or later"]);
    expect(drawn).toEqual(expect.arrayContaining(["2000–04", "2005–09", "2010–14", "2015–19", "2020–26"]));
    expect([...figure.querySelectorAll("rect.period")].map((r) => r.classList.contains("compared"))).toEqual([true, true, false, false, true]);
  });

  it("writes none of those numbers itself", async () => {
    serve((m) => ({
      ...m,
      source: { ...m.source, collected_to: "2027-03-02" },
      trend: {
        ...m.trend,
        periods: [[2001, 2005], [2006, 2010], [2021, 2027]],
        then: [2001, 2010],
        now: [2021, 2027],
        rule: { min_r: 0.25, level: 0.99, min_tvd: 0.3, min_n: 40 },
      },
    }));
    await open("#/methodology/trends");
    const heading = await screen.findByRole("heading", { level: 2, name: "Changes over time" });
    const [first, , , windows, second] = sectionText(heading);
    expect(first).toMatch(/: 2001–05, 2006–10, and 2021 to the end of the collection \(March 2027\)\./);
    expect(windows).toMatch(/^It compares two windows, the stories published 2001–2010 and those published 2021 or later:/);
    expect(second).toMatch(/published in 2021 or later and one published 2001–2010 at random/);
    expect(second).toMatch(/at least 63 times in 100, or the lower one at least 63 times in 100/);
    expect(second).toMatch(/clear at the 99% level, with at least 40 stories on each side/);
    expect(second).toMatch(/at least 25 percentage points; for characteristics with named groups, at least 30% of the newer stories .* the mix of 2001–2010\.$/);
    // and the picture's windows and periods
    const drawn = [...heading.parentElement.querySelectorAll(".trends-figure svg text")].map((t) => t.textContent);
    expect(drawn.slice(0, 2)).toEqual(["2001–2010", "2021 or later"]);
    expect(drawn).toEqual(expect.arrayContaining(["2001–05", "2006–10", "2021–27"]));
    expect([...heading.parentElement.querySelectorAll(".trends-figure rect.period")].map((r) => r.classList.contains("compared"))).toEqual([true, true, true]);
  });
});
