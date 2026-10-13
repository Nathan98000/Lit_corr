// The data update of 2026-10-13 (STAGE2_DATA_UPDATE_PROMPT.md): How it works words every exclusion reason in the data
// and says the sample's size from the data (D5); the count shown before meta.json arrives is the data's own.
import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { clearCache } from "../lib/data.js";
import { aboutCount, typicalSample } from "../lib/wording.js";
import { fixtureFetch, fixtureMeta, realMeta } from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const real = realMeta();

/** A fetch() that serves the test data with this meta.json. */
const withMeta = (meta) => {
  const serve = fixtureFetch();
  return async (url) => (String(url).split("?")[0].endsWith("meta.json") ? { ok: true, status: 200, json: async () => meta } : serve(url));
};

beforeEach(() => {
  clearCache();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function missingData(meta) {
  vi.stubGlobal("fetch", withMeta(meta));
  window.history.replaceState(null, "", "/#/methodology/missing-data");
  render(<App />);
  const heading = await screen.findByRole("heading", { level: 2, name: "Missing data and excluded stories" });
  return heading.nextElementSibling.textContent;
}

describe("Missing data and excluded stories", () => {
  it("words a story left out as a duplicate as the copy does, not by its code", async () => {
    const counts = { sampled: 12, with_text: 11, included: 9, excluded_reasons: { no_text: 1, possibly_not_english: 1, duplicate_of_another_story: 1 } };
    const text = await missingData({ ...fixtureMeta, counts });
    expect(text).toMatch(/^Of the 12 sampled stories, 9 are used in the charts\. 3 were left out: 1 had no story text that could be collected, 1 did not look like English and 1 had the same text as another story\. /);
  });

  it.skipIf(!real)("has words for every reason in the real data", async () => {
    const text = await missingData({ ...fixtureMeta, counts: real.counts });
    expect(Object.keys(real.counts.excluded_reasons).length).toBeGreaterThan(0);
    expect(text).not.toMatch(/left out \(/);
  });
});

describe("the story count before meta.json arrives (D5)", () => {
  it.skipIf(!real)("is the data's own, in the kicker and in index.html's descriptions", async () => {
    const about = aboutCount(real.counts.included); // "about 13,000" for the 20261013 handoff
    const html = readFileSync(path.join(here, "..", "..", "index.html"), "utf8").replace(/\s+/g, " ");
    for (const name of ['name="description"', 'property="og:description"']) {
      expect(html.match(new RegExp(`${name} content="[^"]*"`))?.[0]).toContain(` ${about} stories `);
    }
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    vi.stubGlobal("fetch", async (url) => {
      const rel = String(url).split("aggregates/")[1].split("?")[0];
      if (rel === "meta.json") await gate;
      const body = readFileSync(path.join(here, "..", "..", "public", "aggregates", rel), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    });
    window.history.replaceState(null, "", "/#/genres");
    render(<App />);
    const kicker = () => document.querySelector(".kicker").textContent;
    expect(kicker()).toBe(`Genres · ${about} Literotica stories · ${real.genres.length - 1} genres`); // before
    release();
    await waitFor(() => expect(document.title).toMatch(/^How do genres differ in /)); // the page has its data
    expect(kicker()).toBe(`Genres · ${about} Literotica stories · ${real.genres.length - 1} genres`); // after
  });
});

describe("How it works says the sample's size from the data (D5)", () => {
  const page = async (meta) => {
    vi.stubGlobal("fetch", withMeta(meta));
    window.history.replaceState(null, "", "/#/methodology");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "How it works" });
    const article = document.querySelector("article.methodology");
    const section = (id) => article.querySelector(`#${id}`).nextElementSibling.nextElementSibling?.textContent;
    return {
      inShort: within(article.querySelector(".in-short")).getAllByRole("listitem")[0].textContent,
      sample: section("data"),
      limits: article.querySelector("#limits").nextElementSibling.firstElementChild.textContent,
      text: article.textContent,
    };
  };

  it("in the test data", async () => {
    const n = typicalSample(fixtureMeta);
    const { inShort, sample, limits, text } = await page(fixtureMeta);
    expect(inShort).toMatch(new RegExp(`^A random sample: about ${n} stories in each of 3 genres, collected .+ to .+; [\\d,]+ are used in the charts\\.$`));
    expect(sample).toContain(
      "which list every story whatever its popularity, put the stories found there in a random order, and collected them " +
        `in that order: about ${n} stories per genre.`,
    );
    expect(sample).toContain("the next story in that category’s random order took its place. In all, ");
    expect(limits).toBe(`A sample. About ${n} random stories per genre, not every story on the site. Small groups are uncertain, which is why sample sizes are always shown.`);
    expect(text).not.toMatch(/\b300\b|full sample/);
  });

  it.skipIf(!real)("in the real data: about 420 stories in each of 30 genres", async () => {
    const { inShort, sample, limits } = await page(real);
    expect(inShort).toMatch(/^A random sample: about 420 stories in each of 30 genres, collected .+; 12,568 are used in the charts\.$/);
    expect(sample).toContain("in that order: about 420 stories per genre.");
    expect(limits).toMatch(/^A sample\. About 420 random stories per genre/);
  });
});
