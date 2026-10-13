// The Trends page's View 2, "What changed" (STAGE2_TRENDS_PAGE_PROMPT.md, section 4.1): "One genre" as approved,
// relabeled and drawn by ComparisonProfile: the heading and sample line, the takeaway, the lists and their words, the
// rows (their two windows' numbers, their names and their links to View 1), the topics, the way back, and the too-few
// states.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import {
  changesAnnouncement,
  changesColumns,
  changesHeading,
  changesRowName,
  changesSampleLine,
  changesTakeaway,
  changesTooFewHeading,
  changesWords,
  trendProfile,
  windowCounts,
  windowsCompared,
} from "../lib/trends.js";
import { comparisonBar } from "../lib/genres.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const real = realMeta();
const realTrends = (sub, g) =>
  JSON.parse(readFileSync(path.join(here, "..", "..", "public", "aggregates", "trends", sub, `${g}.json`), "utf8"));
const ALL = { id: "all", name: "All genres" };

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens a View 2 address with the chart `width` px wide (720: stacked; 1032: wide). */
async function openChanges(hash, width = 1032) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
  window.history.replaceState(window.history.state, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(".trends-page .chart-panel[aria-busy='false'] h2")).toBeTruthy());
  return user;
}

describe("the windows and the words", () => {
  it("counts each window's stories from its periods, and compares a genre only with the rule's stories in both", () => {
    const file = fixtureFile("trends/all/all.json");
    expect(windowCounts(file)).toEqual({ then: 86, now: 87 });
    expect(windowsCompared(file)).toBe(true);
    expect(windowsCompared(fixtureFile("trends/all/tiny.json"))).toBe(false);
    expect(windowsCompared(fixtureFile("trends/short/all.json"))).toBe(false); // 28 stories from 2000–2009
  });

  it.skipIf(!real)("counts 2,561 and 3,346 stories for All genres, and leaves Chain Stories and Transgender uncompared", () => {
    expect(windowCounts(realTrends("all", "all"))).toEqual({ then: 2561, now: 3346 });
    const uncompared = real.genres.filter((g) => !windowsCompared(realTrends("all", g.id))).map((g) => g.name);
    expect(uncompared).toEqual(["Chain Stories", "Transgender"]);
  });

  it("words the heading, the sample line and the too-few heading from the file", () => {
    const file = fixtureFile("trends/all/all.json");
    // the denominator: the characteristics compared in the file (the trends review)
    expect(changesHeading(26, 180, file)).toBe("26 of 180 characteristics clearly changed from 2000–2009 to 2020 or later");
    expect(changesHeading(1, 179, file)).toBe("1 of 179 characteristics clearly changed from 2000–2009 to 2020 or later");
    expect(changesHeading(0, 180, file)).toBe("None of the 180 characteristics clearly changed from 2000–2009 to 2020 or later");
    expect(changesSampleLine(file, ALL, { id: "all", label: "All stories" })).toBe("86 stories from 2000–2009 and 87 from 2020 or later across all genres.");
    const medium = fixtureFile("trends/medium/all.json");
    expect(changesSampleLine(medium, ALL, { id: "medium", label: "2,000–5,000 words" })).toBe(
      "43 stories from 2000–2009 and 52 from 2020 or later across all genres match “2,000–5,000 words”.",
    );
    const tiny = { id: "tiny", name: "Tiny" };
    expect(changesTooFewHeading(fixtureFile("trends/all/tiny.json"), tiny, { id: "all" })).toBe(
      "Fewer than 30 stories in Tiny were published 2000–2009: too few to compare",
    );
    expect(changesTooFewHeading(fixtureFile("trends/short/all.json"), ALL, { id: "short", label: "Under 2,000 words" })).toBe(
      "Fewer than 30 stories in All genres match “Under 2,000 words” and were published 2000–2009: too few to compare",
    );
  });

  it("relabels “One genre”'s words: heads, lists, axis title, zone, note, mix line, topics", () => {
    const w = changesWords(fixtureFile("trends/all/all.json"));
    expect(w.heads(true, 58)).toEqual(["2000–09", "2020+"]);
    expect(w.heads(false, 76)).toEqual(["2000–09", "2020+"]);
    // "▼ Fell" on screen, the full title for screen readers (the trends review)
    expect(w.lists).toEqual({
      lower: { mark: "▼", word: "Fell", full: "Fell from 2000–2009 to 2020 or later" },
      higher: { mark: "▲", word: "Rose", full: "Rose from 2000–2009 to 2020 or later" },
      mix: { mark: "≠", word: "A different mix", full: "A different mix from 2000–2009 to 2020 or later" },
    });
    // the values' head says what the numbers are; the axis title in plain words (the trends review's fresh eyes)
    expect(w.valuesHead).toEqual(["Median story or share", "2000–09 → 2020+"]);
    expect(w.axisTitle).toBe("How often a story from 2020 or later comes out higher than a story from 2000–2009, out of 100");
    expect(w.showAll(21, "higher")).toBe("Show all 21 that rose");
    expect(w.showAll(5, "lower")).toBe("Show all 5 that fell");
    expect(w.zone).toBe("no clear change");
    // the note in the owner's words (2026-10-12) and where a row leads (round 4's W1): no link, the same in a topic,
    // "Tap" on a device that can't hover, as "One genre"'s
    expect(w.note({ tap: false })).toBe(
      "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie). Click a row for its chart over time.",
    );
    expect(w.note({ tap: true })).toBe(
      "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie). Tap a row for its chart over time.",
    );
    expect(w.note({ inTopic: true, tap: true })).toBe(w.note({ tap: true }));
    expect(w.note({})).toBe(w.note({ tap: false }));
    // the bars in time's order (the trends review)
    expect(w.mixLine({})).toBe("A different mix: 2000–2009 above, 2020 or later below");
    expect(w.mixLine({ inTopic: true })).toBe("2000–2009 above, 2020 or later below");
    expect(w.topicsLine).toBe(
      "How many characteristics in each topic changed. Open a topic to see them all: blue dots changed, gray dots show no clear change.",
    );
    expect(w.topicCount({ count: 12, compared: 26, items: [] }).text).toBe("12 of 26 changed");
    expect(w.topicCount({ count: 0, compared: 0, items: [1, 2] }).text).toBe("2 characteristics");
  });
});

describe("the rows", () => {
  it("are ordered by the size of the change, the dot's side 2020 or later and the columns in time's order", () => {
    const file = fixtureFile("trends/all/all.json");
    const p = trendProfile(fixtureMeta, file);
    expect(p.higher.map((x) => x.id)).toEqual(["dlg_word_share", "dlg_has_dialogue"]); // r 0.959, then 0.591
    expect(p.lower).toEqual([]);
    expect(p.topics.map((t) => [t.topic.id, t.count, t.compared])).toEqual([
      ["narration", 0, 1],
      ["dialogue", 2, 2],
      ["emotion", 0, 1],
    ]);
    const yes = p.items.find((x) => x.id === "dlg_has_dialogue");
    const cols = changesColumns(yes);
    expect(cols.genre).toEqual([`${Math.round(yes.all.share * 100)}%`]); // 2000–2009 first
    expect(cols.all).toEqual([`${Math.round(yes.stats.share * 100)}%`]);
    expect(changesTakeaway(p)).toEqual([{ mark: "▲", word: "Rose", items: ["dialogue share", "has dialogue"] }]);
  });

  it.skipIf(!real)("are named by their content, then numbers in reading order: “Paragraph count: 68 in 100; 2000–2009 56, 2020 or later 102 paragraphs; clearly rose”", () => {
    const file = realTrends("all", "all");
    const p = trendProfile(real, file);
    const name = (id) => changesRowName(p.items.find((x) => x.id === id), file, real.min_n);
    // the values' relative change, as the row prints it (the trends review)
    expect(name("story_paragraphs")).toBe("Paragraph count: 68 in 100; 2000–2009 56, 2020 or later 102 paragraphs (+82%); clearly rose. Opens its chart over time.");
    expect(name("story_has_author_note")).toBe("Has an author’s note: 57 in 100; 2000–2009 18%, 2020 or later 33%; no clear change. Opens its chart over time.");
    expect(name("rel_consent_per_1k")).toMatch(
      /^Consent and check-in language: \d+ in 100; 2000–2009 11% with any, 2020 or later 21%; no clear change\. Opens its chart over time\.$/,
    );
    expect(name("desc_pov")).toMatch(/^Person of the blurb, % of stories: 2000–2009 First person [\d.]+%, .*; 2020 or later .*; no clear change\. /);
    expect(name("pace_sex_peak_position")).toMatch(/^Where sexual language peaks: \d+ in 100; 2000–2009 median [^,]+, 2020 or later median .+; no clear change\./);
    // a clear change never prints the zone's edge (section 4.2): the build-up of sexual language, r −0.206
    const buildUp = p.items.find((x) => x.id === "pace_sex_shift");
    expect(buildUp.r).toBe(-0.206);
    expect(comparisonBar(buildUp.r).times).toBe(40);
    expect(name("pace_sex_shift")).toMatch(/^Build-up of sexual language: 39 in 100; /);
    const few = trendProfile(real, realTrends("all", "adult-how-to")).items.find((x) => x.r == null);
    if (few) expect(changesRowName(few, realTrends("all", "adult-how-to"), real.min_n)).toMatch(/; too few stories to compare\. Opens its chart over time\.$/);
  });

  it.skipIf(!real)("put the seven topics that have characteristics on this page, “When published” not among them", () => {
    const p = trendProfile(real, realTrends("all", "all"));
    expect(p.topics.map((t) => t.topic.label)).toEqual([
      "Length & structure",
      "Narration",
      "Dialogue & characters",
      "Sexual content",
      "Emotion & relationships",
      "Pacing & setting",
      "Word choice & style",
    ]);
    expect(p.flagged).toHaveLength(26);
  });
});

describe("View 2 on the page", () => {
  it("asks what changed, says how many characteristics clearly changed, and lists them with the windows' numbers", async () => {
    await openChanges("#/trends?view=changes");
    expect(document.querySelector(".trends-page .sentence").textContent.replace(/⁠/g, "")).toMatch(/^What has changed in stories across .*all genres.*\?$/);
    const answer = document.querySelector(".trend-changes");
    expect(within(answer).getByRole("heading", { level: 2 }).textContent).toBe("2 of 4 characteristics clearly changed from 2000–2009 to 2020 or later");
    expect(answer.querySelector(".profile-sample").textContent).toBe("86 stories from 2000–2009 and 87 from 2020 or later across all genres.");
    expect(answer.querySelector(".profile-takeaway").textContent).toBe("▲ Rose: dialogue share, has dialogue.");
    const lists = [...answer.querySelectorAll(".profile-list h3")];
    expect(lists.map((h) => h.querySelector("[aria-hidden='true']").textContent)).toEqual(["▲ Rose"]);
    expect(lists.map((h) => h.querySelector(".visually-hidden").textContent)).toEqual(["Rose from 2000–2009 to 2020 or later"]);
    expect(answer.querySelector(".profile-axis-title").textContent).toBe(
      "How often a story from 2020 or later comes out higher than a story from 2000–2009, out of 100",
    );
    expect(answer.querySelector(".zone-label").textContent).toBe("40–60: no clear change");
    expect([...answer.querySelectorAll(".profile-values-head")].map((h) => [...h.children].map((l) => l.textContent))).toEqual([
      ["Median story or share", "2000–09 → 2020+"],
    ]);
    const row = answer.querySelector(".profile-list .profile-row");
    expect(row.getAttribute("href")).toBe("#/trends?var=dlg_word_share&genre=all&include=all");
    expect(row.querySelector(".visually-hidden").textContent).toMatch(/^Dialogue share: \d+ in 100; 2000–2009 \d+%, 2020 or later \d+%; clearly rose\. Opens its chart over time\.$/);
    const note = answer.querySelector(".profile-note");
    expect(note.textContent).toBe(
      "Each dot compares a story from 2020 or later with a story from 2000–2009 (50 is a tie). Click a row for its chart over time.",
    );
    expect(note.querySelector("a")).toBeNull();
    expect([...answer.querySelectorAll(".profile-topic-count")].map((c) => c.textContent)).toEqual(["0 of 1 changed", "2 of 2 changed", "0 of 1 changed"]);
    expect(answer.querySelector(".profile-topics-line").textContent).toBe(
      "How many characteristics in each topic changed. Open a topic to see them all: blue dots changed, gray dots show no clear change.",
    );
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull(); // gone from the site (O2)
    expect(document.title).toBe("What has changed in stories across all genres?");
  });

  it("says the question, the heading and the takeaway in the polite live region", async () => {
    await openChanges("#/trends?view=changes");
    const region = document.querySelector(".trends-page p.visually-hidden[aria-live='polite']");
    await waitFor(() =>
      expect(region.textContent).toBe(
        "What has changed in stories across all genres? 2 of 4 characteristics clearly changed from 2000–2009 to 2020 or later. Rose: dialogue share, has dialogue.",
      ),
    );
    expect(changesAnnouncement(fixtureMeta, fixtureFile("trends/all/tiny.json"), {})).toBe(
      "What has changed in stories in Tiny Genre? Fewer than 30 stories in Tiny Genre were published 2000–2009: too few to compare.",
    );
  });

  it("opens a row's chart over time in a new history entry, and Back returns with its open topic", async () => {
    const user = await openChanges("#/trends?view=changes");
    const narration = [...document.querySelectorAll(".profile-topic summary")].find((s) => s.textContent.startsWith("Narration"));
    await user.click(narration);
    await waitFor(() => expect(narration.closest("details").querySelector(".profile-row")).toBeTruthy());
    // over the compared named group, which bar is which
    expect(narration.closest("details").querySelector(".profile-mix-line").textContent).toBe("2000–2009 above, 2020 or later below");
    const row = narration.closest("details").querySelector(".profile-row");
    expect(row.getAttribute("href")).toBe("#/trends?var=pov_class&genre=all&include=all");
    await user.click(row);
    await waitFor(() => expect(window.location.hash).toBe("#/trends?var=pov_class&genre=all&include=all"));
    await waitFor(() => expect(document.querySelector(".trend-mix")).toBeTruthy());
    act(() => window.history.back());
    await waitFor(() => expect(window.location.hash).toBe("#/trends?view=changes"));
    await waitFor(() => expect(document.querySelector(".trend-changes")).toBeTruthy());
    const again = [...document.querySelectorAll(".profile-topic")].find((d) => d.querySelector("summary").textContent.startsWith("Narration"));
    expect(again.open).toBe(true);
  });

  it("draws the rows stacked under a chart of 900 px, the heads on the list's title line", async () => {
    await openChanges("#/trends?view=changes", 720);
    const answer = document.querySelector(".trend-changes");
    expect(answer.classList.contains("stacked")).toBe(true);
    expect([...answer.querySelectorAll(".profile-heads .head-line")].map((s) => s.textContent)).toEqual(["Median story or share", "2000–09 → 2020+"]);
  });

  it("says when a window has too few stories, with no lists or topics, and offers all stories, else All genres", async () => {
    const user = await openChanges("#/trends?view=changes&include=short");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Fewer than 30 stories in All genres match “Under 2,000 words” and were published 2000–2009: too few to compare",
    );
    expect(document.querySelector(".profile-list, .profile-topics")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show all stories" }));
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=all&include=all"));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toMatch(/clearly changed/));
    window.location.hash = "#/trends?view=changes&genre=tiny";
    const button = await screen.findByRole("button", { name: "Show All genres" });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Fewer than 30 stories in Tiny Genre were published 2000–2009: too few to compare");
    await user.click(button);
    await waitFor(() => expect(window.location.hash).toBe("#/trends?genre=all&include=all"));
  });
});
