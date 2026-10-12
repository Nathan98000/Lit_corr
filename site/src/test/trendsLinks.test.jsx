// The Trends page's links in from other pages (STAGE2_TRENDS_PAGE_PROMPT.md, section 5): Explore's "Keep exploring"
// item and How it works' "Changes over time", whose numbers come from meta.trend and meta.source.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { SECTIONS } from "../components/Methodology.jsx";
import { trendsQuestion } from "../components/Explorer.jsx";
import { clearCache } from "../lib/data.js";
import { changedOverTime } from "../lib/wording.js";
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
const d = (id, genre = "all") => ({ variable: byId(id), genre: fixtureMeta.genres.find((g) => g.id === genre) });

describe("Explore's “Keep exploring” item", () => {
  it("asks how the characteristic changed over time, the share for yes/no characteristics", () => {
    expect(changedOverTime(byId("dlg_word_share"))).toBe("How has dialogue share changed over time?");
    expect(changedOverTime(byId("dlg_has_dialogue"))).toBe("How has the share of stories with dialogue changed over time?");
    expect(changedOverTime({ noun: "story length in words" })).toBe("How has story length in words changed over time?");
  });

  it("opens View 1 with Explore's genre and, when the Trends page offers it, Explore's option, else all stories", () => {
    const view = (sub, genre = "all") => ({ genre, metric: "pop_views", v: "dlg_word_share", sub });
    expect(trendsQuestion(fixtureMeta, view("medium", "romance"), d("dlg_word_share", "romance")).hash).toBe(
      "#/trends?var=dlg_word_share&genre=romance&include=medium",
    );
    expect(trendsQuestion(fixtureMeta, view("y2020"), d("dlg_word_share")).hash).toBe("#/trends?var=dlg_word_share&genre=all&include=all");
    expect(trendsQuestion(fixtureMeta, view("views10k"), d("dlg_word_share")).state.sub).toBe("all");
    // a characteristic the page leaves out: no item
    expect(trendsQuestion(fixtureMeta, view("all"), { variable: { id: "pub_year", label: "Publication year", noun: "publication year" } })).toBeNull();
  });

  it("sits after the Genres page's question, and fetches the page's code and file when hovered", async () => {
    await open("#/explore?var=dlg_has_dialogue&genre=fetish&include=short");
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Keep exploring" })).toBeTruthy());
    const links = within(screen.getByRole("navigation", { name: "Keep exploring" })).getAllByRole("link");
    const i = links.findIndex((a) => a.textContent === "How has the share of stories with dialogue changed over time? →");
    expect(i).toBe(2);
    expect(links[1].textContent).toMatch(/^What stands out about stories in Fetish\?/);
    expect(links[i].getAttribute("href")).toBe("#/trends?var=dlg_has_dialogue&genre=fetish&include=short");
    fireEvent.pointerEnter(links[i]);
    await waitFor(() => expect(asked.some((u) => u.endsWith("trends/short/fetish.json"))).toBe(true));
  });
});

describe("How it works' “Changes over time”", () => {
  it("comes after “Comparing genres” in the contents", () => {
    const ids = SECTIONS.map(([id]) => id);
    expect(ids.indexOf("trends")).toBe(ids.indexOf("genres") + 1);
    expect(SECTIONS[ids.indexOf("trends")][1]).toBe("Changes over time");
  });

  it("says the periods, the rule and the windows from meta.trend, and the collection's end from meta.source", async () => {
    await open("#/methodology/trends");
    const heading = await screen.findByRole("heading", { level: 2, name: "Changes over time" });
    const text = [];
    // a word joiner keeps each range of years on one line
    for (let el = heading.nextElementSibling; el && el.tagName === "P"; el = el.nextElementSibling) text.push(el.textContent.replace(/\u2060/g, ""));
    expect(heading.nextElementSibling.textContent).toContain("2010–\u206014");
    expect(text).toEqual([
      "The Trends page groups stories by the year they were published: 2000–04, 2005–09, 2010–14, 2015–19, and 2020 to the end of the collection (October 2026). For each period it shows the median and the interquartile range, or the share of stories, with All genres counting each genre by its size on Literotica, as everywhere on this site.",
      // why only the two windows count (the trends review's fresh eyes asked, 6/6)
      "It compares two windows, the stories published 2000–2009 and those published 2020 or later: the oldest and the newest, each pooling several years, so that no thin year can swing the verdict. The periods between are drawn but not compared, so a characteristic that dipped and came back reads “No clear change”; the chart shows the whole shape.",
      "A characteristic clearly changed when, picking one story published in 2020 or later and one published 2000–2009 at random, the newer story would be the higher one at least 60 times in 100, or the lower one at least 60 times in 100 (ties count as half), clear at the 99.9% level, with at least 30 stories on each side. That is the Genres page’s rule. For yes/no characteristics it means a change of at least 20 percentage points; for characteristics with named groups, at least 20% of the newer stories would have to change group to match the mix of 2000–2009.",
      // no fixed-mix check and no length bands: the owner took both off the page (2026-10-12)
      "The stories are the ones still on Literotica when they were collected, in today’s categories: stories removed from the site are not in the sample. Two characteristics are not on this page: the number of tags, which jumps between stories published before 2005 (a median of 10) and after (4), and the author’s number of stories, which was counted when the stories were collected, not when they were published.",
    ]);
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
    const text = [];
    for (let el = heading.nextElementSibling; el && el.tagName === "P"; el = el.nextElementSibling) text.push(el.textContent.replace(/\u2060/g, ""));
    const [first, windows, second] = text;
    expect(first).toMatch(/: 2001–05, 2006–10, and 2021 to the end of the collection \(March 2027\)\./);
    expect(windows).toMatch(/^It compares two windows, the stories published 2001–2010 and those published 2021 or later:/);
    expect(second).toMatch(/published in 2021 or later and one published 2001–2010 at random/);
    expect(second).toMatch(/at least 63 times in 100, or the lower one at least 63 times in 100/);
    expect(second).toMatch(/clear at the 99% level, with at least 40 stories on each side/);
    expect(second).toMatch(/at least 25 percentage points; for characteristics with named groups, at least 30% of the newer stories .* the mix of 2001–2010\.$/);
  });
});
