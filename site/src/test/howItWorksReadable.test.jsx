// How it works made easier to read (the owner, 2026-10-14): "Where the stories come from" says when the stories were
// collected, what was and wasn't collected and how they were picked at random, not how the collector worked; every
// section is short paragraphs and lists; and seven pictures show the sampling, the rules' view of a passage, a chart's
// marks, the genres' shares, the strength words, the One genre view's scale and the Trends page's windows, each with
// the data's own numbers. (The sections' exact words for comparing genres, changes over time, the sample's size and the
// excluded stories: genresLinks, trendsLinks and dataUpdate.)
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { STRENGTH, strengthWord } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, "..", "..", "..");
const real = realMeta();

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", fixtureFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** How it works on the test data, or with this meta.json. */
async function openPage(meta = null) {
  if (meta) {
    const serve = fixtureFetch();
    vi.stubGlobal("fetch", async (url) => (String(url).endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url)));
  }
  window.history.replaceState(null, "", "/#/methodology");
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "How it works" });
  return document.querySelector("article.methodology");
}

const words = (node) => node.textContent.replace(/\s+/g, " ").trim();

/** A section's blocks, from its heading to the next: paragraphs' words, a list as its items' words, a picture as its class. */
function section(article, id) {
  const out = [];
  for (let el = article.querySelector(`#${id}`).nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling) {
    if (el.tagName === "UL" || el.tagName === "OL") out.push([...el.children].map(words));
    else if (el.tagName === "FIGURE") out.push(`figure.${el.classList[1]}`);
    else out.push(words(el));
  }
  return out;
}

describe("Where the stories come from", () => {
  it("says when, what was and wasn't collected, and how the stories were picked at random, from the data", async () => {
    const article = await openPage();
    expect(section(article, "data")).toEqual([
      "The stories were collected from Literotica between October 1, 2026 and October 8, 2026.",
      "What was collected",
      [
        "About 120 stories from each of 3 of Literotica’s genres (the site itself calls them categories): 278 stories in all.",
        "For each story, its text and these details from its page: the title, blurb, publication date and tags; the " +
          "author’s number of stories; and its views, favorites, comments, average rating, number of ratings and " +
          "reading-list adds. The text, titles and blurbs are not on this site.",
        "Each chapter of a long work, as one story: Literotica gives every chapter its own page and numbers.",
      ],
      "What was not collected",
      [
        "The audio, illustrated and non-English categories, since the measures need English prose.",
        "Stories removed from Literotica before the collection.",
        "Anything behind a login, and the comments themselves (only their number).",
      ],
      "How the stories were picked",
      "Every story in a genre had the same chance of being picked, popular or not:",
      "figure.steps-figure",
    ]);
  });

  it("no longer describes the collector", async () => {
    const article = await openPage();
    const text = words(article.querySelector("#data").parentElement);
    expect(text).not.toMatch(/collector|robots\.txt|eight seconds|one page at a time|politely|signaled|logging in|never used search/i);
  });

  it("draws the sampling as four numbered steps, each a picture hidden from screen readers and a sentence", async () => {
    const article = await openPage();
    const steps = [...article.querySelectorAll(".sample-steps > li")];
    // the number is a badge beside the title (the list numbers the steps for screen readers)
    expect(steps.map((li) => [li.querySelector(".step-num").textContent, li.querySelector(".step-title").lastChild.textContent])).toEqual([
      ["1", "Every story, A to Z"],
      ["2", "Pages at even steps"],
      ["3", "A random order"],
      ["4", "About 120 per genre"],
    ]);
    for (const li of steps) {
      expect(li.querySelector(".step-num").getAttribute("aria-hidden")).toBe("true");
      expect(li.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
    }
    expect(steps.map((li) => words(li.querySelector(".step-text")))).toEqual([
      "A genre’s listing by title names every story in it, popular or not.",
      "Pages of that listing were picked at even steps, from a random first page.",
      "The stories on those pages were shuffled into a random order.",
      "Stories were collected in that order. One that couldn’t be (it had been removed, or the site kept returning an " +
        "error for it) was replaced by the next.",
    ]);
    // the second picture marks every 4th page from the 2nd; the last, five stories collected from six places
    expect([...steps[1].querySelectorAll("rect.pg")].map((r) => r.classList.contains("read"))).toEqual(
      Array.from({ length: 16 }, (_, i) => i % 4 === 1),
    );
    expect(steps[3].querySelectorAll("circle.story")).toHaveLength(5);
    expect(steps[3].querySelectorAll(".lost")).toHaveLength(1);
  });
});

describe("the other sections, in short paragraphs and lists", () => {
  it("measures popularity in the measure menu's order, with worked examples", async () => {
    const article = await openPage();
    const [intro, ways] = section(article, "popularity");
    expect(intro).toMatch(/^Each story’s numbers are the ones its page showed when the story was collected: one snapshot per story, taken between October 1, 2026 and October 8, 2026\./);
    expect(ways.map((w) => w.split(/[:(]/)[0].trim())).toEqual(["Average rating", "Per 1,000 views", "Per month online", "Totals so far"]);
    // the examples' arithmetic: 80 / 20,000 × 1,000 = 4; 20,000 / 40 = 500; 48,763 to three significant figures
    expect(ways[1]).toContain("80 favorites from 20,000 views are 4 favorites per 1,000 views.");
    expect(ways[2]).toContain("so 20,000 views over 40 months are 500 views per month.");
    expect(ways[3]).toContain("(48,763 became 48,800)");
    expect(Number((48763).toPrecision(3))).toBe(48800);
  });

  it("keeps every paragraph short: no wall of text", async () => {
    const article = await openPage();
    const long = [...article.querySelectorAll("p")]
      .map((p) => words(p))
      .filter((t) => t.split(" ").length > 60);
    expect(long).toEqual([]);
  });

  it("has no subsections (the owner, 2026-10-13): the lists' labels are not headings", async () => {
    const article = await openPage();
    expect(article.querySelectorAll("h3, h4")).toHaveLength(0);
    const labels = [...article.querySelectorAll(".how-label")].map(words);
    expect(labels).toEqual(["What was collected", "What was not collected", "How the stories were picked", "Keep in mind"]);
    for (const l of article.querySelectorAll(".how-label")) expect(l.tagName).toBe("P");
  });

  it("puts each picture in its section, titled, its drawing hidden from screen readers", async () => {
    const article = await openPage();
    const where = [...article.querySelectorAll("figure.how-figure")].map((f) => {
      let h = f.previousElementSibling;
      while (h.tagName !== "H2") h = h.previousElementSibling;
      return [f.classList[1], h.id, f.querySelector("figcaption")?.textContent ?? null];
    });
    expect(where).toEqual([
      ["steps-figure", "data", null],
      ["example-figure", "measures", "What the rules see in a made-up passage"],
      ["marks-figure", "charts", "What a chart draws"],
      ["sizes-figure", "charts", "Each genre’s share of the stories, largest first"],
      ["strength-figure", "tend-to", "Weak, moderate and strong, on the rank correlation"],
      ["compare-figure", "genres", "How the One genre view draws it, out of 100"],
      ["trends-figure", "trends", "The Trends page’s periods, and the two windows it compares"],
    ]);
    for (const svg of article.querySelectorAll("figure.how-figure svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the pictures' numbers come from the data", () => {
  it("names a chart's marks with the data's group sizes", async () => {
    const article = await openPage({ ...fixtureMeta, min_n: 12, small_n: 40 });
    expect([...article.querySelectorAll(".chart-key li")].map(words)).toEqual([
      "Median of each group, with its value printed beside it",
      "Interquartile range of each group",
      "Fewer than 40 stories: drawn hatched, with a hollow dot. They deserve less trust.",
      "Fewer than 12 stories: not shown; the row says “Too few stories to show”.",
      "Median of all stories: the dashed line, with its value under the chart",
    ]);
  });

  it("shows each genre's share on Literotica and in the sample, largest first (the test data's uneven samples)", async () => {
    const article = await openPage();
    const figure = article.querySelector(".sizes-figure");
    // Fetish 4,000 of 5,050 stories on the site (79%); 150 of 278 in the sample (54%)
    expect([...figure.querySelectorAll(".sizes-label, .sizes-note")].map(words)).toEqual([
      "On Literotica, in these 3 genres: 5,050 stories",
      "Fetish, the largest genre: 79%",
      "In the sample: 278 stories",
      "Fetish: 54%",
    ]);
    const bars = [...figure.querySelectorAll("svg.share-bar")].map((svg) => [...svg.querySelectorAll("rect")].map((r) => r.getAttribute("width")));
    expect(bars[0].map(parseFloat).map(Math.round)).toEqual([79, 20, 1]);
    expect(bars[1].map(parseFloat).map(Math.round)).toEqual([54, 43, 3]);
  });

  it("says the largest genre's sample share is about the same as every genre's only when it is", async () => {
    const genres = fixtureMeta.genres.map((g, i) => (g.id === "all" ? { ...g, n: 1257 } : { ...g, n: [420, 419, 418][i - 1] }));
    const article = await openPage({ ...fixtureMeta, genres });
    expect(words(article.querySelectorAll(".sizes-note")[1])).toBe("Fetish: 33%, about the same as every genre");
  });

  it.skipIf(!real)("shows the real genres' shares: Erotic Couplings 12% of the site's stories, 3% of the sample", async () => {
    const article = await openPage(real);
    expect([...article.querySelectorAll(".sizes-figure .sizes-label, .sizes-figure .sizes-note")].map(words)).toEqual([
      "On Literotica, in these 30 genres: 763,174 stories",
      "Erotic Couplings, the largest genre: 12%",
      "In the sample: 12,568 stories",
      "Erotic Couplings: 3%, about the same as every genre",
    ]);
  });

  it("draws weak, moderate and strong from the thresholds the titles use", async () => {
    expect([0.19, 0.2, 0.39, 0.4].map(strengthWord)).toEqual(["weak", "moderate", "moderate", "strong"]);
    const article = await openPage();
    const drawn = [...article.querySelectorAll(".strength-figure svg text")].map((t) => t.textContent);
    expect(drawn).toEqual(["Weak", "Moderate", "Strong", "0", String(STRENGTH.moderate), String(STRENGTH.strong), "1"]);
    expect(words(article.querySelector("#tend-to").parentElement)).toContain(
      `weak below ${STRENGTH.moderate}, moderate from ${STRENGTH.moderate} to ${STRENGTH.strong}, strong ${STRENGTH.strong} or more`,
    );
  });
});

describe("the made-up passage", () => {
  const featuresPy = path.join(REPO, "litcorr", "text", "features.py");
  const positive = path.join(REPO, "lexicons", "emotion_positive.txt");

  it("marks the dialogue, the narration's pronouns and a word from a list, with a key", async () => {
    const article = await openPage();
    const figure = article.querySelector(".example-figure");
    const passage = figure.querySelector(".example-text");
    expect(words(passage)).toBe("I was not happy. “We should go,” she said. I nodded, reaching for my coat.");
    expect([...passage.querySelectorAll(".ex-dialogue")].map((s) => s.textContent)).toEqual(["“We should go,”"]);
    expect([...passage.querySelectorAll(".ex-pron")].map((s) => s.textContent)).toEqual(["I", "she", "I", "my"]);
    expect([...passage.querySelectorAll(".ex-word")].map((s) => s.textContent)).toEqual(["happy"]);
    expect([...figure.querySelectorAll(".example-key li")].map(words)).toEqual([
      "“We should go,” Dialogue is the words inside quotation marks; everything else is narration.",
      "I she my Point of view is read from the narration’s pronouns; the “We” in the dialogue doesn’t count.",
      "happy Word lists: “happy” is on the positive-emotion list, so it counts, even after “not”.",
    ]);
  });

  it.skipIf(!existsSync(featuresPy) || !existsSync(positive))("is what the text measures really count", async () => {
    // the pronoun sets of litcorr/text/features.py (FP_SING = frozenset("i me my …".split()), …)
    const py = readFileSync(featuresPy, "utf8");
    const set = (name) => new Set(py.match(new RegExp(`^${name} = frozenset\\("([^"]+)"\\.split\\(\\)\\)`, "m"))[1].split(" "));
    const [first, plural, masc, fem, neutral] = ["FP_SING", "FP_PLUR", "MASC", "FEM", "NEUTRAL"].map(set);
    const article = await openPage();
    const passage = article.querySelector(".example-text");
    const marked = [...passage.querySelectorAll(".ex-pron")].map((s) => s.textContent.toLowerCase());
    for (const w of marked) expect(first.has(w) || masc.has(w) || fem.has(w) || neutral.has(w), w).toBe(true);
    // every pronoun of the narration is marked, and the dialogue's "We" is one the rule would count in narration
    const narration = words(passage).replace(/“[^”]*”/g, " ").toLowerCase().match(/[a-z’']+/g);
    const pronouns = narration.filter((w) => first.has(w) || masc.has(w) || fem.has(w) || neutral.has(w));
    expect(pronouns).toEqual(marked);
    expect(plural.has("we")).toBe(true);
    // "happy" is a line of the positive-emotion list
    expect(readFileSync(positive, "utf8").split("\n").map((l) => l.trim())).toContain("happy");
  });
});
