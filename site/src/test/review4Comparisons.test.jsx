// Design review 4, phase 6 (W1): one grammar for the two comparisons. "One genre"'s note above the first list, in the
// Trends page's words, saying what a tap does, the same in an open topic; its axis title in the Trends page's words, on
// the page and in the image; a position (where something starts or peaks) under its own word in the takeaway; the two
// values of a row with the same decimals; units on a line of their own on both pages; the Trends page's note saying
// where a row leads. (The rows the decimals rule leaves with more than one trailing zero or fewer than two significant
// digits are listed in DESIGN_REVIEW_4.md, section 11.)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { downloadChartImage, listsImagePlan } from "../lib/chartImage.js";
import { clearCache } from "../lib/data.js";
import {
  POSITION_WORDS,
  axisTitle,
  genreProfile,
  pairText,
  positionWord,
  profileColumns,
  profileNote,
  profileTakeaway,
  takeawayLine,
} from "../lib/genres.js";
import { changesColumns, changesWords, trendProfile } from "../lib/trends.js";
import { lowerFirst } from "../lib/wording.js";
import { CAUSAL, UK_SPELLINGS } from "./scans.js";
import { fixtureFetch, fixtureFile, fixtureMeta, realMeta } from "./fixtures.js";

vi.mock("../lib/chartImage.js", async (original) => ({ ...(await original()), downloadChartImage: vi.fn(async () => {}) }));

const here = path.dirname(fileURLToPath(import.meta.url));
const AGG = path.join(here, "..", "..", "public", "aggregates");
const real = realMeta();
const realFile = (sub = "all") => JSON.parse(readFileSync(path.join(AGG, "genres", `${sub}.json`), "utf8"));
const realOptions = () => (real ? readdirSync(path.join(AGG, "genres")).map((f) => f.replace(/\.json$/, "")) : []);
const realFetch = async (url) => {
  const body = readFileSync(path.join(AGG, String(url).split("aggregates/")[1]), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const css = readFileSync(path.join(here, "..", "comparison.css"), "utf8");
const OFF_THE_PAGE = /typical story|typical age|middle half|borderline|just past/i;
const romance = fixtureMeta.genres.find((g) => g.id === "romance");
const fetish = fixtureMeta.genres.find((g) => g.id === "fetish");
const joined = (parts) => (Array.isArray(parts) ? parts.join("") : parts);

/** Romance standing out on purpose (as genresProfile.test.jsx's test data): two lists, and Fetish on nothing. */
function standOuts(body) {
  if (body.n[2] < body.rule.min_n) return body;
  const set = (id, r, f) => Object.assign(body.c[id], { r, f });
  set("dlg_word_share", [null, 0.05, -0.32, null], [0, 0, -1, 0]);
  set("emo_anger_per_1k", [null, 0.02, 0.24, null], [0, 0, 1, 0]);
  set("dlg_has_dialogue", [null, -0.01, 0.21, null], [0, 0, 1, 0]);
  set("pov_class", [null, 0.03, 0.27, null], [0, 0, 1, 0]);
  return body;
}

/** The test data, the genres' and trends' files edited by `edit(body, url)`. */
function serve(edit = (body) => body) {
  const base = fixtureFetch();
  return async (url) => {
    const res = await base(url);
    if (!String(url).includes("genres/") && !String(url).includes("trends/")) return res;
    const body = edit(await res.json(), String(url));
    return { ok: true, status: 200, json: async () => body };
  };
}
const genresEdit = (body, url) => (url.includes("genres/") ? standOuts(body) : body);

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", serve(genresEdit));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens an address with the chart `width` px wide (720: stacked; 1032: wide), the panel drawn. */
async function open(hash, { width = 720, ready = ".chart-panel[aria-busy='false']" } = {}) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 });
  window.history.replaceState(null, "", `/${hash}`);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(document.querySelector(ready)).toBeTruthy());
  return user;
}

const openAllTopics = async (user) => {
  for (const s of document.querySelectorAll(".profile-topic summary")) await user.click(s);
};

const hoverNone = () =>
  vi.stubGlobal("matchMedia", (q) => ({ matches: q === "(hover: none)", media: q, addEventListener() {}, removeEventListener() {} }));

describe("W1: “One genre”'s note, above the first list, in the Trends page's words", () => {
  it("says what a dot compares, that 50 is a tie, and what a tap does; its link is one piece", () => {
    expect(joined(profileNote(romance, { tap: true }))).toBe(
      "Each dot compares a story in Romance with a story from all genres, counting every story, not only the medians " +
        "(50 is a tie; how this is decided). Tap a row for every genre’s numbers.",
    );
    expect(joined(profileNote(romance, { tap: false }))).toMatch(/\. Click a row for every genre’s numbers\.$/);
    // the link's words never break inside, and the gray dots are the topics' line's to explain
    expect(profileNote(romance)[1]).toBe("how this is decided");
    expect(joined(profileNote(romance))).not.toMatch(/[Gg]ray dots|in the topics below/);
  });

  it("sits above the first list, after the takeaway, with its link, “Click” where the device can hover", async () => {
    await open("#/genres?view=genre&genre=romance&include=all");
    const notes = document.querySelectorAll(".profile-note");
    expect(notes).toHaveLength(1);
    const [note] = notes;
    expect(note.closest(".profile-list")).toBeNull();
    expect(note.nextElementSibling).toBe(document.querySelector(".profile-list"));
    expect(note.previousElementSibling.classList.contains("profile-takeaway")).toBe(true);
    expect(note.textContent).toBe(joined(profileNote(romance, { tap: false })));
    expect(note.querySelector("a").getAttribute("href")).toBe("#/methodology/genres");
    expect(note.querySelector("a").textContent).toBe("how this is decided");
    // the link's target stays 44 px tall
    expect(css).toMatch(/\.profile-note a::after \{[^}]*height: max\(100%, var\(--target\)\);/);
  });

  it("says “Tap” on a device that can't hover", async () => {
    hoverNone();
    await open("#/genres?view=genre&genre=romance&include=all");
    expect(document.querySelector(".profile-note").textContent).toBe(joined(profileNote(romance, { tap: true })));
  });

  it("goes in the same words with every open topic that has dots when no list is shown", async () => {
    const user = await open("#/genres?view=genre&genre=fetish&include=all");
    expect(document.querySelector(".profile-list, .profile-note")).toBeNull();
    await openAllTopics(user);
    const topics = [...document.querySelectorAll(".profile-topic")].filter((t) => t.querySelector(".p2-dot"));
    expect(topics.length).toBeGreaterThan(1);
    for (const t of topics) expect(t.querySelector(".profile-note").textContent).toBe(joined(profileNote(fetish, { tap: false })));
  });
});

describe("W1: “One genre”'s axis title, in the Trends page's words", () => {
  it("reads as the Trends page's, with the genre and all genres for its sides", () => {
    const trends = changesWords(fixtureFile("trends/all/all.json"));
    const shape = (s, a, b) => s.replace(a, "A").replace(b, "B");
    expect(shape(axisTitle(romance), "in Romance", "from all genres")).toBe(shape(trends.axisTitle, "from 2020 or later", "from 2000–2009"));
    expect(axisTitle(romance)).toBe("How often a story in Romance comes out higher than a story from all genres, out of 100");
  });

  it("is the same on the page and in the image", async () => {
    downloadChartImage.mockClear();
    const user = await open("#/genres?view=genre&genre=romance&include=all");
    const title = document.querySelector(".profile-axis-title").textContent;
    expect(title).toBe(axisTitle(romance));
    await user.click(screen.getByRole("button", { name: "Download image of what stands out" }));
    await waitFor(() => expect(downloadChartImage).toHaveBeenCalledTimes(1));
    const plan = listsImagePlan(downloadChartImage.mock.calls[0][0]);
    expect(plan.lists[0].caption).toBe(title);
  });
});

describe("W1: a position under its own word in the takeaway", () => {
  it.skipIf(!real)("reads each position's word from its own more_word and less_word (meta.json), never from Higher/Lower", () => {
    const positions = real.variables.filter((v) => POSITION_WORDS.includes(v.more_word) || POSITION_WORDS.includes(v.less_word));
    expect(positions.length).toBeGreaterThan(0);
    for (const variable of positions) {
      expect(positionWord({ variable, kind: "num", f: 1 })).toBe(variable.more_word);
      expect(positionWord({ variable, kind: "num", f: -1 })).toBe(variable.less_word);
      expect(positionWord({ variable, kind: "num", f: 0 })).toBeNull();
    }
    const amount = real.variables.find((v) => !positions.includes(v) && v.more_word);
    expect(positionWord({ variable: amount, kind: "num", f: 1 })).toBeNull();
  });

  it.skipIf(!real)("lists Romance's “where the first sex scene starts” as ▲ Later, after Higher, while the lists keep their titles", () => {
    const file = realFile();
    const p = genreProfile(real, file, file.genres.indexOf("adult-romance"));
    const lines = profileTakeaway(p);
    const later = lines.find((l) => l.word === "Later");
    expect(later.mark).toBe("▲");
    const expected = p.higher.filter((x) => positionWord(x) === "Later").slice(0, 3).map((x) => lowerFirst(x.variable.label));
    expect(later.items).toEqual(expected);
    expect(takeawayLine(later)).toMatch(/^Later: where the first sex scene starts/);
    expect(lines.map((l) => l.word).indexOf("Later")).toBe(lines.map((l) => l.word).indexOf("Higher") + 1);
    const higher = lines.find((l) => l.word === "Higher");
    expect(higher.items.some((label) => expected.includes(label))).toBe(false);
    // the list below still has them, under its title
    expect(p.higher.filter((x) => positionWord(x)).length).toBeGreaterThan(0);
  });

  it.skipIf(!real)("keeps the lines' order and puts each position under its word, for every genre and option", { timeout: 30000 }, () => {
    const ORDER = ["Lower", "Earlier", "Sooner", "Higher", "Later", "A different mix"];
    let positioned = 0;
    for (const sub of realOptions()) {
      const file = realFile(sub);
      for (let gi = 1; gi < file.genres.length; gi += 1) {
        const p = genreProfile(real, file, gi);
        const lines = profileTakeaway(p);
        const words = lines.map((l) => l.word);
        expect(words, `${sub} ${file.genres[gi]}`).toEqual(ORDER.filter((w) => words.includes(w)));
        const byLabel = new Map(p.items.map((x) => [lowerFirst(x.variable.label), x]));
        for (const line of lines.filter((l) => l.word !== "A different mix")) {
          for (const label of line.items) {
            const word = positionWord(byLabel.get(label));
            const at = `${sub} ${file.genres[gi]} ${label}`;
            if (line.word === "Lower" || line.word === "Higher") expect(word, at).toBeNull();
            else expect(word, at).toBe(line.word);
            if (word) positioned += 1;
          }
        }
      }
    }
    expect(positioned).toBeGreaterThan(0);
  });

  it.skipIf(!real)("shows the line on the page: “▲ Later: where the first sex scene starts, …”", { timeout: 15000 }, async () => {
    vi.stubGlobal("fetch", realFetch);
    await open("#/genres?view=genre&genre=adult-romance&include=all");
    const lines = [...document.querySelectorAll(".profile-takeaway p")].map((p) => p.textContent);
    expect(lines).toContainEqual(expect.stringMatching(/^▲ Later: where the first sex scene starts, /));
  });
});

describe("W1: the same decimals in a row", () => {
  it("gives the larger three significant digits, the smaller at least two, and keeps a trailing zero only where the other needs it", () => {
    // the prompt's examples
    expect(pairText(7.8, 19.3)).toEqual(["7.8", "19.3"]);
    expect(pairText(10, 3.8)).toEqual(["10.0", "3.8"]);
    expect(pairText(2.32, 5.75)).toEqual(["2.32", "5.75"]);
    expect(pairText(309, 137)).toEqual(["309", "137"]);
    // the smaller needs another decimal: both take it
    expect(pairText(12.3, 0.84)).toEqual(["12.30", "0.84"]);
    // a round value beside a value with more decimals, and a negative scale
    expect(pairText(3, 3.08)).toEqual(["3.00", "3.08"]);
    expect(pairText(-0.2, -0.154)).toEqual(["−0.200", "−0.154"]);
    // a last decimal both end on a 0 is dropped, even where the smaller is then left with one significant digit
    expect(pairText(9.02, 10)).toEqual(["9", "10"]);
    // one side missing
    expect(pairText(null, 3.2)).toEqual(["–", "3.2"]);
    expect(pairText(null, null)).toEqual(["–", "–"]);
  });

  it.skipIf(!real)("holds for every row of every genre and option: the same decimals, never a shared trailing zero", { timeout: 60000 }, () => {
    const decimals = (t) => (t.includes(".") ? t.split(".")[1].replace(/[^0-9]/g, "").length : 0);
    let pairs = 0;
    let changed = 0;
    for (const sub of realOptions()) {
      const file = realFile(sub);
      for (let gi = 1; gi < file.genres.length; gi += 1) {
        for (const item of genreProfile(real, file, gi).items) {
          if (!item.stats || !item.all) continue;
          const now = profileColumns(item);
          const before = profileColumns(item, { pair: false });
          const medians = item.kind === "num" || (item.kind === "zero" && now.genre.length > 1);
          if (!medians || item.nf.fmt !== "num") {
            // shares, percentages and years keep today's format
            expect(now, `${sub} ${file.genres[gi]} ${item.id}`).toEqual(before);
            continue;
          }
          const k = now.genre.length - 1;
          const [g, a] = [now.genre[k], now.all[k]];
          if (g === "–" || a === "–") continue;
          pairs += 1;
          if (g !== before.genre[k] || a !== before.all[k]) changed += 1;
          const at = `${sub} ${file.genres[gi]} ${item.id}: ${g} vs ${a}`;
          expect(decimals(g), at).toBe(decimals(a));
          if (decimals(g) > 0) expect(g.endsWith("0") && a.endsWith("0"), at).toBe(false);
        }
      }
    }
    expect(pairs).toBeGreaterThan(1000);
    expect(changed).toBeGreaterThan(0);
  });

  it.skipIf(!real)("is “One genre”'s: the Trends page's columns keep each value trimmed on its own", { timeout: 30000 }, () => {
    let differ = 0;
    for (const sub of real.trend.subsets) {
      for (const g of ["all", "adult-romance", "chain-stories"]) {
        const file = JSON.parse(readFileSync(path.join(AGG, "trends", sub, `${g}.json`), "utf8"));
        for (const item of trendProfile(real, file).items) {
          if (!item.stats || !item.all) continue;
          const own = profileColumns(item, { pair: false });
          expect(changesColumns(item)).toEqual({ ...own, genre: own.all, all: own.genre });
          if (JSON.stringify(profileColumns(item)) !== JSON.stringify(own)) differ += 1;
        }
      }
    }
    expect(differ).toBeGreaterThan(0); // the rule would have changed some
  });
});

describe("W1: units on a line of their own", () => {
  it("draws every unit as a block under the row's name, on every chart width (comparison.css)", () => {
    expect(css).toMatch(/\.profile-unit \{\s*display: block;/);
    expect(css).not.toMatch(/\.profile-unit[^{]*\{[^}]*display: inline/);
    expect(css).not.toMatch(/\.profile-unit\.long/);
  });

  for (const [page, hash, ready] of [
    ["“One genre”", "#/genres?view=genre&genre=romance&include=all", ".genres-page .chart-panel[aria-busy='false']"],
    ["“What changed”", "#/trends", ".trends-page .chart-panel[aria-busy='false']"],
  ]) {
    for (const width of [360, 1032]) {
      it(`puts the unit right after the row's hidden name, with no space or class of its own, on ${page} at ${width} px`, async () => {
        const user = await open(hash, { width, ready });
        await openAllTopics(user);
        const units = [...document.querySelectorAll(".profile-row .profile-unit")];
        expect(units.length).toBeGreaterThan(0);
        for (const unit of units) {
          expect(unit.parentElement.classList.contains("profile-name")).toBe(true);
          expect([...unit.classList].filter((c) => c !== "profile-unit" && c !== "profile-of")).toEqual([]);
          const before = unit.previousSibling;
          expect(before.nodeType).toBe(Node.ELEMENT_NODE); // the hidden name or the unit above it, no text between
          expect(unit.getAttribute("aria-hidden")).toBe("true");
        }
      });
    }
  }
});

describe("W1: the Trends page's note says where a row leads", () => {
  const trends = ".trends-page .chart-panel[aria-busy='false']";

  it("reads “… (50 is a tie). Click a row for its chart over time.” above the first list", async () => {
    await open("#/trends", { ready: trends });
    const note = document.querySelector(".profile-note");
    expect(note.textContent).toBe(words().note({ tap: false }));
    expect(note.textContent).toMatch(/ \(50 is a tie\)\. Click a row for its chart over time\.$/);
    expect(note.nextElementSibling).toBe(document.querySelector(".profile-list"));
  });

  it("says “Tap” on a device that can't hover, and the same in an open topic when nothing changed", async () => {
    hoverNone();
    vi.stubGlobal(
      "fetch",
      serve((body, url) => {
        if (url.includes("trends/")) for (const e of Object.values(body.c)) e.f = 0;
        return body;
      }),
    );
    const user = await open("#/trends", { ready: trends });
    expect(document.querySelector(".profile-list, .profile-note")).toBeNull();
    await openAllTopics(user);
    const notes = [...document.querySelectorAll(".profile-topic .profile-note")].map((n) => n.textContent);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n).toBe(words().note({ tap: true }));
    expect(notes[0]).toMatch(/ Tap a row for its chart over time\.$/);
  });
});

describe("W1: the new words pass the copy scans", () => {
  it("are US English, never causal, with no plain “because” and none of the words taken off the pages", () => {
    const trends = words();
    const strings = [
      joined(profileNote(romance, { tap: true })),
      joined(profileNote(romance, { tap: false })),
      axisTitle(romance),
      trends.note({ tap: true }),
      trends.note({ tap: false }),
      ...POSITION_WORDS,
    ];
    for (const s of strings) {
      expect(s).not.toMatch(UK_SPELLINGS);
      expect(s).not.toMatch(CAUSAL);
      expect(s).not.toMatch(/\bbecause\b/i);
      expect(s).not.toMatch(OFF_THE_PAGE);
    }
  });
});

function words() {
  return changesWords(fixtureFile("trends/all/all.json"));
}
